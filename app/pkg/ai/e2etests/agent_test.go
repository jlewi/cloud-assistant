package e2etests

import (
	"context"
	"github.com/jlewi/cloud-assistant/app/pkg/ai"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"google.golang.org/protobuf/encoding/protojson"
	"sync"
	"testing"
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

	client, err := ai.NewClient(*cfg)
	if err != nil {
		t.Fatal(err)
	}

	agent, err := ai.NewAgent(cfg.CloudAssistant, client)
	if err != nil {
		t.Fatalf("Failed to create agent: %+v", err)
	}
	req := &cassie.GenerateRequest{
		Blocks: []*cassie.Block{
			{
				Id:       "1",
				Contents: "How do I create a K8s cluster at my company?",
				Role:     cassie.BlockRole_BLOCK_ROLE_USER,
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

	if len(resp.Blocks) != 2 {
		t.Fatalf("Expected 2 blocks; got %d", len(resp.Blocks))
	}

	for _, b := range resp.Blocks {
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
