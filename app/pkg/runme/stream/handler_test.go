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

// todo(sebastian): reuses Runme's after moving it out under internal
func genULID() ulid.ULID {
	runID := ulid.MustNew(ulid.Timestamp(time.Now()), ulid.DefaultEntropy())
	return runID
}

// dialWebSocket dials a websocket URL with a random id for testing and returns the connection, response, and error.
func dialWebSocket(ts *httptest.Server, runID string) (*Connection, *http.Response, error) {
	streamID := strings.ReplaceAll(uuid.New().String(), "-", "")
	wsURL := "ws" + ts.URL[len("http"):] + "?id=" + streamID + "&runID=" + runID
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

	sc, resp, err := dialWebSocket(ts, genULID().String())
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

	h := NewWebSocketHandler(
		&runme.Runner{Server: mockRunmeServer},
		&iam.AuthContext{Checker: &iam.AllowAllChecker{}},
	)

	ts := httptest.NewServer(http.HandlerFunc(h.Handler))
	defer ts.Close()

	sc, _, err := dialWebSocket(ts, genULID().String())
	if err != nil {
		t.Errorf("Failed to dial websocket: %v", err)
		return
	}

	runID := genULID()

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

func TestRunmeHandler_MutliClient(t *testing.T) {
	runID := genULID()
	expectSequence := []string{"hello from mock runme", "bye bye"}

	mockRunmeServer := newMockRunmeServer()
	mockRunmeServer.SetResponder(func() error {
		for i, resp := range expectSequence {
			mockRunmeServer.executeResponses <- &v2.ExecuteResponse{
				StdoutData: []byte(resp),
			}
			time.Sleep(10 * time.Millisecond * time.Duration(i+1))
		}
		mockRunmeServer.executeResponses <- &v2.ExecuteResponse{
			ExitCode: &wrappers.UInt32Value{Value: 0},
		}
		return nil
	})

	h := NewWebSocketHandler(
		&runme.Runner{Server: mockRunmeServer},
		&iam.AuthContext{Checker: &iam.AllowAllChecker{}},
	)

	ts := httptest.NewServer(http.HandlerFunc(h.Handler))
	defer ts.Close()

	numSockets := 5
	connections := make([]*Connection, 0, numSockets)

	for i := range numSockets {
		sc, _, err := dialWebSocket(ts, runID.String())
		if err != nil {
			t.Fatalf("Failed to dial websocket %d: %v", i+1, err)
		}
		connections = append(connections, sc)
	}

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

	// A single ExecuteRequest is enough to start processing inside the multiplexer.
	if err := connections[0].WriteMessage(websocket.TextMessage, dummyReq); err != nil {
		t.Fatalf("Expected no error on sc1, got %v", err)
	}

	defer func() {
		for i, sc := range connections {
			err := sc.Close()
			if err != nil {
				t.Errorf("Expected no error closing socket %d, got %v", i+1, err)
			}
		}
	}()

	type result struct {
		seq []string
		err error
	}

	readSequence := func(sc *Connection) result {
		var seq []string
		for {
			dummyResp, err := sc.ReadSocketResponse(context.Background())
			if err != nil {
				return result{seq, err}
			}
			if dummyResp.GetExecuteResponse().GetExitCode() != nil {
				return result{seq, nil}
			}
			stdout := string(dummyResp.GetExecuteResponse().GetStdoutData())
			seq = append(seq, stdout)
		}
	}

	resCh := make(chan struct {
		idx int
		res result
	}, numSockets)

	for i, sc := range connections {
		go func(idx int, conn *Connection) {
			resCh <- struct {
				idx int
				res result
			}{idx, readSequence(conn)}
		}(i, sc)
	}

	results := make([]result, numSockets)
	for range numSockets {
		out := <-resCh
		results[out.idx] = out.res
	}

	// Check all connection's results match the expected sequence
	for i, expected := range expectSequence {
		for j, seq := range results {
			if len(seq.seq) <= i {
				t.Errorf("Socket %d: expected message '%s' at index %d, but got only %d messages", j+1, expected, i, len(seq.seq))
				continue
			}
			if seq.seq[i] != expected {
				t.Errorf("Socket %d: expected '%s', got '%s' at message %d", j+1, expected, seq.seq[i], i)
			}
		}
	}
}
