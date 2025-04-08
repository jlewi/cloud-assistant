package ai

import (
	"context"
	"encoding/json"

	"connectrpc.com/connect"
	"github.com/go-logr/zapr"
	"github.com/google/uuid"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/responses"
	"go.uber.org/zap"

	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	"go.opentelemetry.io/otel/trace"
)

const (
	// DefaultInstructions is the default system prompt to use when generating responses
	DefaultInstructions = `You are an internal Cloud Assistant. Your job is to help developers deploy and operate
their software on their Company's internal cloud. The Cloud consists of Kubernetes clusters, Azure, GitHub, etc...
uses Datadog for monitoring. You have access to CLIs like kubectl, gh, yq, jq, git, az, bazel, curl, wget, etc...
If you need a user to run a command to act or observe the cloud you should respond with the shell tool call.
You also have access to internal documentation which you can use to search for information about
how to use the cloud.

You have access to all the CLIs and tools that Developers use to deploy and operate their software on
the cloud. So you should always try to run commands on a user's behalf and save them the work of invoking
it themselves.

Follow these rules
* Do not rely on outdated documents for determining the status of systems and services.
* Do use the shell tool to run commands to observe the current status of the Cloud
`

	DefaultShellToolDescription = `The shell tool executes CLIs (e.g. kubectl, gh, yq, jq, git, az, bazel, curl, wget, etc...
These CLIs can be used to act and observe on the cloud (Kubernetes, GitHub, Azure, etc...).
The input is a short bash program that can be executed. Additional CLIs can be installed by running the appropriate
commands.`

	ShellToolName = "shell"
)

// Agent implements the AI Service
// https://buf.build/jlewi/foyle/file/main:foyle/v1alpha1/agent.proto#L44
type Agent struct {
	Client               *openai.Client
	instructions         string
	shellToolDescription string
	vectorStoreIDs       []string
	filenameToLink       func(string) string
}

// AgentOptions are options for creating a new Agent
type AgentOptions struct {
	VectorStores []string
	Client       *openai.Client
	// Instructions are the prompt to use when generating responses
	Instructions string
	// ShellToolDescription is the description of the shell tool.
	ShellToolDescription string

	// FilenameToLink is an optional function that converts a filename to a link to be displayed in the UI.
	FilenameToLink func(string) string
}

// FromAssistantConfig overrides the AgentOptions based on the values from the AssistantConfig
func (o *AgentOptions) FromAssistantConfig(cfg config.CloudAssistantConfig) error {
	o.VectorStores = cfg.VectorStores

	// TODO(jlewi): We should allow the user to specify the instructions in the config as a path to a file containing
	// the instructions.
	return nil
}

func NewAgent(opts AgentOptions) (*Agent, error) {

	if opts.Client == nil {
		return nil, errors.New("Client is nil")
	}
	log := zapr.NewLogger(zap.L())
	if opts.Instructions == "" {
		opts.Instructions = DefaultInstructions
		log.Info("Using default system prompt")
	}

	if opts.ShellToolDescription == "" {
		opts.ShellToolDescription = DefaultShellToolDescription
		log.Info("Using default shell tool description")
	}

	return &Agent{
		Client:               opts.Client,
		instructions:         opts.Instructions,
		shellToolDescription: opts.ShellToolDescription,
		filenameToLink:       opts.FilenameToLink,
		vectorStoreIDs:       opts.VectorStores,
	}, nil
}

var (
	shellToolJSONSchema = map[string]any{
		"$schema": "http://json-schema.org/draft-07/schema#",
		"title":   "Shell Function Schema",
		"type":    "object",
		"properties": map[string]interface{}{
			"shell": map[string]interface{}{
				"type":        "string",
				"description": "A short bash program to be executed by bash",
			},
		},
		"required":             []string{"shell"},
		"additionalProperties": false,
	}
)

func (a *Agent) Generate(ctx context.Context, req *connect.Request[cassie.GenerateRequest], resp *connect.ServerStream[cassie.GenerateResponse]) error {
	return a.ProcessWithOpenAI(ctx, req.Msg, resp.Send)
}

func (a *Agent) ProcessWithOpenAI(ctx context.Context, req *cassie.GenerateRequest, sender BlockSender) error {
	span := trace.SpanFromContext(ctx)
	log := logs.FromContext(ctx)
	traceId := span.SpanContext().TraceID()
	log = log.WithValues("traceId", traceId)
	log.Info("Agent.Generate")

	if (len(req.Blocks)) < 1 {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("Blocks must be non-empty"))
	}

	tools := make([]responses.ToolUnionParam, 0, 1)

	if len(a.vectorStoreIDs) > 1 {
		// TODO(jlewi): Does OpenAI support multiple vector stores?
		return connect.NewError(connect.CodeInternal, errors.New("Expected at most one vector store"))
	}

	if len(a.vectorStoreIDs) > 0 {
		fileSearchTool := &responses.FileSearchToolParam{
			MaxNumResults:  openai.Opt(int64(5)),
			VectorStoreIDs: a.vectorStoreIDs,
		}

		tool := responses.ToolUnionParam{
			OfFileSearch: fileSearchTool,
		}
		tools = append(tools, tool)
	}
	shellTool := &responses.FunctionToolParam{
		Name:        ShellToolName,
		Description: openai.Opt(a.shellToolDescription),
		Parameters:  shellToolJSONSchema,
		// N.B. I'm not sure what the point of strict would be since we have a single string argument.
		Strict: false,
	}

	tool := responses.ToolUnionParam{
		OfFunction: shellTool,
	}
	tools = append(tools, tool)
	// TODO(jlewi): We should add websearch

	// If PreviousResponseId is not set then we need to check that the first block is user input.
	if req.PreviousResponseId == "" {
		if req.Blocks[0].Role != cassie.BlockRole_BLOCK_ROLE_USER {
			return connect.NewError(connect.CodeInvalidArgument, errors.New("First block must be user input"))
		}
	}

	toolChoice := responses.ResponseNewParamsToolChoiceUnion{
		OfToolChoiceMode: openai.Opt(responses.ToolChoiceOptionsAuto),
	}

	input := responses.ResponseNewParamsInputUnion{
		// N.B. Input is a list of list. Is that a bug in the SDK
		// ResponseInputParam is a type alias for a list. I find that very confusing.
		OfInputItemList: make([]responses.ResponseInputItemUnionParam, 0, len(req.Blocks)),
	}

	for _, b := range req.Blocks {
		switch b.Kind {
		case cassie.BlockKind_MARKUP:
			input.OfInputItemList = append(input.OfInputItemList, responses.ResponseInputItemUnionParam{
				// N.B. What's the difference between EasyInputMessage and InputItemMessage
				OfMessage: &responses.EasyInputMessageParam{
					Role: responses.EasyInputMessageRoleUser,
					Content: responses.EasyInputMessageContentUnionParam{
						OfString: openai.Opt(b.Contents),
					},
				},
			})
		case cassie.BlockKind_CODE:
			dict := map[string]string{}

			for _, o := range b.Outputs {
				dict[o.Kind.String()] = ""
				for _, item := range o.Items {
					if item.TextData != "" {
						dict[o.Kind.String()] += item.TextData
					}
				}
			}

			output, err := json.Marshal(dict)
			if err != nil {
				return connect.NewError(connect.CodeInternal, errors.Wrap(err, "Failed to marshal output"))
			}

			shellArgs := &ShellArgs{
				Shell: b.Contents,
			}

			shellArgsJSON, err := json.Marshal(shellArgs)
			if err != nil {
				return connect.NewError(connect.CodeInternal, errors.Wrap(err, "Failed to marshal shell args"))
			}

			// The CallID will be blank if it wasn't generated by the model.
			// This can happen if
			// 1. The AI returned code blocks in markdown which we parsed out into code blocks
			// 2. User manaually added the cell
			if b.CallId == "" {
				b.CallId = uuid.NewString()
			}

			// Add the function call to the input
			input.OfInputItemList = append(input.OfInputItemList, responses.ResponseInputItemUnionParam{
				OfFunctionCall: &responses.ResponseFunctionToolCallParam{
					// TODO(jlewi): What if the model didn't tell us to call that function?
					CallID:    b.CallId,
					Name:      ShellToolName,
					Arguments: string(shellArgsJSON),
				},
			})

			input.OfInputItemList = append(input.OfInputItemList, responses.ResponseInputItemUnionParam{
				OfFunctionCallOutput: &responses.ResponseInputItemFunctionCallOutputParam{
					// TODO(jlewi): What if the model didn't tell us to call that function?
					CallID: b.CallId,
					Output: string(output),
				},
			})
		default:
			return connect.NewError(connect.CodeInvalidArgument, errors.Errorf("Unsupported block kind %s", b.Kind))
		}
	}

	createResponse := responses.ResponseNewParams{
		Input:             input,
		Instructions:      openai.Opt(a.instructions),
		Model:             openai.ChatModelGPT4oMini,
		Tools:             tools,
		ParallelToolCalls: openai.Bool(true),
		ToolChoice:        toolChoice,
		// We want it to return the file search results
		Include: []responses.ResponseIncludable{responses.ResponseIncludableFileSearchCallResults},
	}

	if req.PreviousResponseId != "" {
		createResponse.PreviousResponseID = openai.Opt(req.PreviousResponseId)
	}

	log.Info("ResponseRequest", "request", createResponse)
	eStream := a.Client.Responses.NewStreaming(ctx, createResponse)

	builder := NewBlocksBuilder(a.filenameToLink)

	return builder.HandleEvents(ctx, eStream, sender)
}
