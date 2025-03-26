package ai

import (
	"connectrpc.com/connect"
	"context"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/responses"

	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	"go.opentelemetry.io/otel/trace"
)

// Agent implements the AI Service
// https://buf.build/jlewi/foyle/file/main:foyle/v1alpha1/agent.proto#L44
type Agent struct {
	Config *config.CloudAssistantConfig
	Client *openai.Client
}

func NewAgent(cfg *config.CloudAssistantConfig, client *openai.Client) (*Agent, error) {
	if cfg == nil {
		return nil, errors.New("Config is nil")
	}
	if client == nil {
		return nil, errors.New("Client is nil")
	}
	return &Agent{
		Config: cfg,
		Client: client,
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
				"description": "A short Bash program to be executed in bash",
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

	if len(a.Config.VectorStores) > 1 {
		// TODO(jlewi): Does OpenAI support multiple vector stores?
		return connect.NewError(connect.CodeInternal, errors.New("Expected at most one vector store"))
	}

	if len(a.Config.VectorStores) > 0 {
		fileSearchTool := &responses.FileSearchToolParam{
			MaxNumResults:  openai.Opt(int64(5)),
			VectorStoreIDs: []string{a.Config.VectorStores[0]},
		}

		tool := responses.ToolUnionParam{
			OfFileSearch: fileSearchTool,
		}
		tools = append(tools, tool)
	}
	shellTool := &responses.FunctionToolParam{
		Name: "shell",
		Description: openai.Opt(`The shell tool executes CLIs (e.g. kubectl, gh, yq, jq, git, az, bazel, curl, wget, etc...
These CLIs can be used to act and observe on the cloud (Kubernetes, GitHub, Azure, etc...).
The input is a short bash program that can be executed. Additional CLIs can be installed by running the appropriate
commands.
`),
		Parameters: shellToolJSONSchema,
		// N.B. I'm not sure what the point of strict would be since we have a single string argument.
		Strict: false,
	}

	tool := responses.ToolUnionParam{
		OfFunction: shellTool,
	}
	tools = append(tools, tool)
	// TODO(jlewi): We should add websearch

	if req.Blocks[0].Role != cassie.BlockRole_BLOCK_ROLE_USER {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("First block must be user input"))
	}

	// TODO(jlewi): I think we should use the instructions field to provide instructions.
	// However, it looks like that's currently not in the golang SDK client.
	// https://platform.openai.com/docs/api-reference/responses/create

	// TODO(jlewi): We should probably make the prompt configurable. So you can include the company name
	// It could just be a file
	const system = `You are an internal Cloud Assistant. Your job is to help developers deploy and operate
their software on their Company's internal cloud. The Cloud consists of Kubernetes clusters, Azure, GitHub, etc...
uses Datadog for monitoring. You have access to CLIs like kubectl, gh, yq, jq, git, az, bazel, curl, wget, etc...
If you need a user to run a command to act or observe the cloud you should respond with the shell tool call.
You also have access to internal documentation which you can use to search for information about
how to use the cloud.

You have access to all the CLIs and tools that Developers use to deploy and operate their software on 
the cloud. So you should always try to run commands on a user's behalf and save them the work of invoking
it themselves.
`

	toolChoice := responses.ResponseNewParamsToolChoiceUnion{
		OfToolChoiceMode: openai.Opt(responses.ToolChoiceOptionsAuto),
	}

	input := responses.ResponseNewParamsInputUnion{
		OfString: openai.Opt(req.Blocks[0].Contents),
	}

	createResponse := responses.ResponseNewParams{
		Input:             input,
		Instructions:      openai.Opt(system),
		Model:             openai.ChatModelGPT4oMini,
		Tools:             tools,
		ParallelToolCalls: openai.Bool(true),
		ToolChoice:        toolChoice,

		// We want it to return the file search results
		Include: []responses.ResponseIncludable{responses.ResponseIncludableFileSearchCallResults},
	}

	eStream := a.Client.Responses.NewStreaming(context.TODO(), createResponse)

	builder := NewBlocksBuilder()

	return builder.HandleEvents(ctx, eStream, sender)
}
