package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/iam"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	v2 "github.com/runmedev/runme/v3/api/gen/proto/go/runme/runner/v2"
	"google.golang.org/protobuf/encoding/protojson"
)

func TestWebSocketHandler_Handler_SwitchingProtocols(t *testing.T) {
	runner := &Runner{server: &mockRunmeServer{}}
	h := &WebSocketHandler{runner: runner, checker: &iam.AllowAllChecker{}}

	ts := httptest.NewServer(http.HandlerFunc(h.Handler))
	defer ts.Close()

	wsURL := "ws" + ts.URL[len("http"):]
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Unexpected websocket upgrade error: %v", err)
	}
	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("Expected 101, got %d", resp.StatusCode)
	}
}

type mockRunmeServer struct {
	v2.UnimplementedRunnerServiceServer
}

func (m *mockRunmeServer) Execute(p v2.RunnerService_ExecuteServer) error {
	_, err := p.Recv()
	if err != nil {
		return err
	}
	return p.Send(&v2.ExecuteResponse{
		StdoutData: []byte("hello from mock runme"),
	})
}

func TestRunmeHandler_Roundtrip(t *testing.T) {
	runner := &Runner{server: &mockRunmeServer{}}
	h := &WebSocketHandler{runner: runner, checker: &iam.AllowAllChecker{}}

	ts := httptest.NewServer(http.HandlerFunc(h.Handler))
	defer ts.Close()

	wsURL := "ws" + ts.URL[len("http"):]
	c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Errorf("Failed to dial websocket: %v", err)
	}
	defer func() {
		err := c.Close()
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	}()

	req, err := protojson.Marshal(&cassie.SocketRequest{
		Payload: &cassie.SocketRequest_ExecuteRequest{
			ExecuteRequest: &v2.ExecuteRequest{
				Config: &v2.ProgramConfig{
					ProgramName:   "/bin/zsh",
					Arguments:     make([]string, 0),
					LanguageId:    "sh",
					Background:    false,
					FileExtension: "",
					Source: &v2.ProgramConfig_Commands{
						Commands: &v2.ProgramConfig_CommandList{
							Items: []string{"echo", "hi"},
						},
					},
					Interactive: true,
					Mode:        v2.CommandMode_COMMAND_MODE_INLINE,
				},
			},
		},
	})
	if err != nil {
		t.Errorf("Failed to marshal message: %v", err)
	}

	err = c.WriteMessage(websocket.TextMessage, req)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	_, msg, err := c.ReadMessage()
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	resp := &cassie.SocketResponse{}
	err = protojson.Unmarshal(msg, resp)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if string(resp.GetExecuteResponse().GetStdoutData()) != "hello from mock runme" {
		t.Errorf("Expected 'hello', got '%s'", string(resp.GetExecuteResponse().GetStdoutData()))
	}
}
