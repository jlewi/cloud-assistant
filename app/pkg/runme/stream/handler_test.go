package stream

import (
	"context"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang/protobuf/ptypes/wrappers"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/iam"
	"github.com/jlewi/cloud-assistant/app/pkg/runme"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/oklog/ulid/v2"
	v2 "github.com/runmedev/runme/v3/api/gen/proto/go/runme/runner/v2"
	"google.golang.org/protobuf/encoding/protojson"
)

// dialWebSocket dials a websocket URL with a random id for testing and returns the connection, response, and error.
func dialWebSocket(ts *httptest.Server) (*Connection, *http.Response, error) {
	id := strings.ReplaceAll(uuid.New().String(), "-", "")
	wsURL := "ws" + ts.URL[len("http"):] + "?id=" + id
	c, r, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, nil, err
	}

	return NewConnection(c), r, nil
}

func TestWebSocketHandler_Handler_SwitchingProtocols(t *testing.T) {
	h := &WebSocketHandler{
		runner: &runme.Runner{Server: newMockRunmeServer()},
		auth: &iam.AuthContext{
			Checker: &iam.AllowAllChecker{},
		},
	}

	ts := httptest.NewServer(http.HandlerFunc(h.Handler))
	defer ts.Close()

	sc, resp, err := dialWebSocket(ts)
	if err != nil {
		t.Errorf("Failed to dial websocket: %v", err)
	}
	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("Expected 101, got %d", resp.StatusCode)
	}

	err = sc.Close()
	if err != nil {
		t.Errorf("Failed to close websocket: %v", err)
	}
}

type mockRunmeServer struct {
	v2.UnimplementedRunnerServiceServer
	responder        func() error
	executeResponses chan *v2.ExecuteResponse
}

func newMockRunmeServer() *mockRunmeServer {
	return &mockRunmeServer{
		executeResponses: make(chan *v2.ExecuteResponse, 100),
	}
}

func (m *mockRunmeServer) SetResponder(responder func() error) {
	m.responder = responder
}

func (m *mockRunmeServer) Execute(p v2.RunnerService_ExecuteServer) error {
	_, err := p.Recv()
	if err != nil {
		return err
	}

	go func() {
		if err := m.responder(); err != nil {
			log.Panic(err)
		}
		close(m.executeResponses)
	}()

	for resp := range m.executeResponses {
		if err := p.Send(resp); err != nil {
			return err
		}
	}

	return nil
}

// TestRunmeHandler_Roundtrip tests the integration of the websocket handler,
// multiplexer and processor with the Runme server.
func TestRunmeHandler_Roundtrip(t *testing.T) {
	mockRunmeServer := newMockRunmeServer()
	mockRunmeServer.SetResponder(func() error {
		mockRunmeServer.executeResponses <- &v2.ExecuteResponse{
			StdoutData: []byte("hello from mock runme"),
		}
		time.Sleep(100 * time.Millisecond)
		mockRunmeServer.executeResponses <- &v2.ExecuteResponse{
			StdoutData: []byte("bye bye"),
		}
		time.Sleep(200 * time.Millisecond)
		mockRunmeServer.executeResponses <- &v2.ExecuteResponse{
			ExitCode: &wrappers.UInt32Value{Value: 0},
		}
		return nil
	})

	h := NewWebSocketHandler(&runme.Runner{Server: mockRunmeServer}, &iam.AuthContext{
		Checker: &iam.AllowAllChecker{},
	})

	ts := httptest.NewServer(http.HandlerFunc(h.Handler))
	defer ts.Close()

	sc, _, err := dialWebSocket(ts)
	if err != nil {
		t.Errorf("Failed to dial websocket: %v", err)
		return
	}

	// todo(sebastian): reuses Runme's after moving it out under internal
	runID := ulid.MustNew(ulid.Timestamp(time.Now()), ulid.DefaultEntropy())

	dummyReq, err := protojson.Marshal(&cassie.SocketRequest{
		RunId: runID.String(),
		Payload: &cassie.SocketRequest_ExecuteRequest{
			ExecuteRequest: &v2.ExecuteRequest{
				Config: &v2.ProgramConfig{
					Source: &v2.ProgramConfig_Commands{
						Commands: &v2.ProgramConfig_CommandList{
							Items: []string{"echo", "hi"},
						},
					},
				},
			},
		},
	})
	if err != nil {
		t.Errorf("Failed to marshal message: %v", err)
	}

	err = sc.WriteMessage(websocket.TextMessage, dummyReq)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	defer func() {
		err := sc.Close()
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	}()

	for {
		dummyResp, err := sc.ReadSocketResponse(context.Background())
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
			return
		}

		// Cleanly return if we received an exit code
		if dummyResp.GetExecuteResponse().GetExitCode() != nil {
			return
		}

		// Verify stdout data matches expected sequence
		stdout := string(dummyResp.GetExecuteResponse().GetStdoutData())
		if stdout != "hello from mock runme" && stdout != "bye bye" {
			t.Errorf("Unexpected stdout data: '%s'", stdout)
		}
	}
}
