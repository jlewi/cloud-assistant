package e2etests

import (
	"bytes"
	"context"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/go-logr/zapr"
	"github.com/jlewi/cloud-assistant/app/pkg/ai"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	"go.uber.org/zap"
	"google.golang.org/protobuf/encoding/protojson"
)

func Test_Agent(t *testing.T) {
	SkipIfMissing(t, "RUN_MANUAL_TESTS")
	app := application.NewApp()
	if err := app.LoadConfig(nil); err != nil {
		t.Fatal(err)
	}
	if err := app.SetupLogging(); err != nil {
		t.Fatal(err)
	}
	cfg := app.GetConfig()

	client, err := ai.NewClient(*cfg.OpenAI)

	if err != nil {
		t.Fatalf("Failed to create client; %v", err)
	}

	agentOptions := &ai.AgentOptions{}

	if err := agentOptions.FromAssistantConfig(*cfg.CloudAssistant); err != nil {
		t.Fatalf("Failed to create agent options; %v", err)
	}

	agentOptions.Client = client

	agent, err := ai.NewAgent(*agentOptions)

	if err != nil {
		t.Fatalf("Failed to create agent: %+v", err)
	}
	req := &cassie.GenerateRequest{
		Blocks: []*cassie.Block{
			{
				Id:       "1",
				Contents: "Use kubectl to tell me the current status of the rube-dev deployment in the a0s context? Do not rely on outdated documents.",
				Role:     cassie.BlockRole_BLOCK_ROLE_USER,
				Kind:     cassie.BlockKind_MARKUP,
			},
		},
	}

	resp := &ServerResponseStream{
		Events: make([]*cassie.GenerateResponse, 0, 10),
		Blocks: make(map[string]*cassie.Block),
	}

	if err := agent.ProcessWithOpenAI(context.Background(), req, resp.Send); err != nil {
		t.Fatalf("Error processing request: %+v", err)
	}

	// Check if there is a code execution block
	codeBlocks := make([]*cassie.Block, 0, len(resp.Blocks))
	for _, b := range resp.Blocks {
		if b.Kind == cassie.BlockKind_CODE {
			t.Logf("Found code block with ID: %s", b.Id)
			// Optionally, you can check the contents of the block
			t.Logf("Code block contents: %s", b.Contents)
			matched, err := regexp.Match(`kubectl.*get.*deployment.*`, []byte(b.Contents))
			if err != nil {
				t.Errorf("Error matching regex: %v", err)
				continue
			}

			if !matched {
				t.Errorf("Code block does not match expected pattern; got\n%v", b.Contents)
				continue
			}

			// Rewrite the command so we know its a command that's safe to execute automatically
			b.Contents = `kubectl --context=a0s -n rube get deployment rube-dev -o yaml`
			codeBlocks = append(codeBlocks, b)
		}
	}

	if len(codeBlocks) == 0 {
		t.Fatalf("No code blocks found in response")
	}

	// Now lets execute a command and provide it to the AI to see how it responds.
	if err := executeBlock(codeBlocks[0]); err != nil {
		t.Fatalf("Failed to execute command: %+v", err)
	}

	previousResponseID := resp.Events[0].ResponseId
	if previousResponseID == "" {
		t.Fatalf("Previous response ID is empty")
	}
	// Now we need to send the output back to the AI
	codeReq := &cassie.GenerateRequest{
		PreviousResponseId: previousResponseID,
		Blocks: []*cassie.Block{
			codeBlocks[0],
		},
	}

	codeResp := &ServerResponseStream{
		Events: make([]*cassie.GenerateResponse, 0, 10),
		Blocks: make(map[string]*cassie.Block),
	}

	if err := agent.ProcessWithOpenAI(context.Background(), codeReq, codeResp.Send); err != nil {
		t.Fatalf("Error processing request: %+v", err)
	}

	for _, b := range codeResp.Blocks {
		o := protojson.MarshalOptions{
			Multiline: true,
			Indent:    "  ",
		}
		j, err := o.Marshal(b)
		if err != nil {
			t.Fatalf("Failed to marshal block: %+v", err)
		}
		t.Logf("Block:\n%+v", string(j))
	}
}

type ServerResponseStream struct {
	Events []*cassie.GenerateResponse
	Blocks map[string]*cassie.Block
	mu     sync.Mutex
}

func (s *ServerResponseStream) Send(e *cassie.GenerateResponse) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Events = append(s.Events, e)

	for _, b := range e.Blocks {
		s.Blocks[b.Id] = b
	}
	return nil
}

// Run the given command and return the output
func executeBlock(b *cassie.Block) error {
	log := zapr.NewLogger(zap.L())
	args := strings.Split(b.Contents, " ")

	cmd := exec.Command(args[0], args[1:]...)
	//cmd := exec.Command("kubectl", "--context=a0s", "-n", "rube", "get", "deployment", "rube-dev", "-o", "yaml")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	if err != nil {
		log.Error(err, "Failed to run command", "cmd", b.Contents, "stdout", stdout.String(), "stderr", stderr.String())
		return errors.Wrapf(err, "Failed to run %s", b.Contents)
	}

	//applyCmd := cmd.NewCmdOptions(cmd.Options{
	//	Streaming: false,
	//}, args[0], args[1:]...)
	//
	//// Start the command and immediately return
	//log.Info("Running command", "cmd", helpers.CmdToString(*applyCmd))
	//statusChan := applyCmd.Start()
	//
	//// Wait for the command to complete
	//finalStatus := <-statusChan
	//
	//if finalStatus.Error != nil {
	//	log.Error(finalStatus.Error, "Command didn't complete successfully", "cmd", helpers.CmdToString(*applyCmd), "exitCode", finalStatus.Exit)
	//	return errors.Wrapf(finalStatus.Error, "Failed to run %s", helpers.CmdToString(*applyCmd))
	//}

	log.Info("Command completed successfully", "stdout", stdout.String(), "stderr", stderr.String())

	b.Outputs = []*cassie.BlockOutput{
		{
			Kind: cassie.BlockOutputKind_STDOUT,
			Items: []*cassie.BlockOutputItem{
				{
					TextData: stdout.String(),
				},
			},
		},
		{
			Kind: cassie.BlockOutputKind_STDERR,
			Items: []*cassie.BlockOutputItem{
				{
					TextData: stderr.String(),
				},
			},
		},
	}

	if stdout.Len() == 0 && stderr.Len() == 0 {
		return errors.New("No output from command")
	}

	return nil
}
