package server

import (
	"context"
	"io"
	"net/http"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	v2 "github.com/runmedev/runme/v3/api/gen/proto/go/runme/runner/v2"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Implement origin checking as needed
		// TODO(jlewi): Do we need to check ORIGIN?
		return true
	},
}

// WebSocketHandler is a handler for websockets.
type WebSocketHandler struct {
	runner *Runner
}

func (h *WebSocketHandler) Handler(w http.ResponseWriter, r *http.Request) {
	log := logs.FromContext(r.Context())

	// This is a hack to see if we are getting multiple requests.
	// We should really use OTEL and traces
	requestID := uuid.NewString()[0:8]
	log = log.WithValues("requestID", requestID)
	log.Info("Handling websocket request")

	if h.runner.server == nil {
		log.Error(errors.New("Runner server is nil"), "Runner server is nil")
		http.Error(w, "Runner server is nil; server is not properly configured", http.StatusInternalServerError)
		return
	}

	if r.Method == http.MethodHead {
		// Front end issues a HEAD request to test if its authenticated
		log.Info("HEAD request; returning 200 OK")
		w.WriteHeader(http.StatusOK)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error(err, "Could not upgrade to websocket")
		http.Error(w, "Could not upgrade to websocket", http.StatusInternalServerError)
		return
	}

	defer conn.Close()
	processor := NewRunmeHandler(r.Context(), conn, h.runner)

	// This will keep reading messages and streaming the outputs until the connection is closed.
	processor.receive()
	log.Info("Websocket request finished")
}

// RunmeHandler is a processor for messages received over a websocket from a single RunmeConsole element
// in the DOM.
//
// There is one instance of this struct per websocket connection; i.e. each instance handles a single websocket
// connection. There is also 1 websocket connection per RunmeConsole element (block) in the UI.
// So this RunmeHandler is only handling one UI block. However, multiple commands can be sent over
// the websocket connection. Right now we only support non-interactive commands. So the protocol is
// client sends a single ExecuteRequest and then the server responds with multiple ExecuteResponses.
// The runnerv2service.Execute method is invoked once per ExecuteRequest; it will terminate when execution finishes.
// However, the UI could send additional ExecuteRequests over the same websocket connection. These could
// be a stop/terminate message to indicate we should abort a long running command.
//
// However, we should also be robust to the case where the UI erroneously sends a new request before the current one
// has finished.
type RunmeHandler struct {
	Ctx    context.Context
	Conn   *websocket.Conn
	Runner *Runner

	mu sync.Mutex
	// p is the processor that is currently processing messages. If p is nil then no processor is currently processing
	p *SocketMessageProcessor
}

func NewRunmeHandler(ctx context.Context, conn *websocket.Conn, runner *Runner) *RunmeHandler {
	return &RunmeHandler{
		Ctx:    ctx,
		Conn:   conn,
		Runner: runner,
	}
}

// receive reads messages from the websocket connection and puts them on the ExecuteRequests channel.
func (h *RunmeHandler) receive() {
	log := logs.FromContext(h.Ctx)
	for {

		messageType, message, err := h.Conn.ReadMessage()
		if err != nil {
			log.Info("Closing ExecuteRequest channel", "err", err)
			// Close the channel.
			// This will cause Recv to return io.EOF which will signal to the Runme that no messages are expected
			p := h.getInflight()
			if p != nil {
				p.close()
			}

			closeErr, ok := err.(*websocket.CloseError)

			if !ok {
				// For now assume unexpected errors are fatal and we should terminate the request.
				// This way at least they will be noticeable and we can see if it makes sense to try to keep going
				log.Error(err, "Could not read message")
				return
			}

			log.Info("Connection closed", "closeCode", closeErr.Code, "closeText", closeErr.Error())
			return
		}

		req := &cassie.SocketRequest{}

		switch messageType {
		case websocket.TextMessage:
			// Parse the message
			if err := protojson.Unmarshal(message, req); err != nil {
				log.Error(err, "Could not unmarshal message as SocketRequest")
				continue
			}
			log.Info("Received message", "message", req)
		case websocket.BinaryMessage:
			// Parse the message
			if err := proto.Unmarshal(message, req); err != nil {
				log.Error(err, "Could not unmarshal message as SocketRequest")
				continue
			}
			log.Info("Received message", "message", req)
		default:
			log.Error(nil, "Unsupported message type", "messageType", messageType)
			continue
		}

		if req.GetExecuteRequest() == nil {
			log.Info("Received message doesn't contain an ExecuteRequest")
			continue
		}

		p := h.getInflight()
		if p == nil {
			p = NewSocketMessageProcessor(h.Ctx)
			h.setInflight(p)
			go h.execute(p)

			// start a separate goroutine to send responses to the client
			go h.sendResponses(p.ExecuteResponses)
		}
		// TODO(jlewi): What should we do if a user tries to send a new request before the current one has finished?
		// How can we detect if its a new request? Should we check if anything other than a "Stop" request is sent
		// after the first request? Right now we are just passing it along to RunME. Hopefully, RunMe handles it.

		// Put the request on the channel
		// Access the local variable to ensure its always set at this point and avoid race conditions.
		p.ExecuteRequests <- req.GetExecuteRequest()
	}
}

func (h *RunmeHandler) getInflight() *SocketMessageProcessor {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.p
}

func (h *RunmeHandler) setInflight(p *SocketMessageProcessor) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.p = p
}

// execute invokes the Runme runner to execute the request.
// It returns when the request has been processed by Runme.
func (h *RunmeHandler) execute(p *SocketMessageProcessor) {
	defer h.setInflight(nil)
	// On exit we close the executeResponses channel because no more responses are expected from runme.
	defer close(p.ExecuteResponses)
	log := logs.FromContext(h.Ctx)
	// Send the request to the runner
	if err := h.Runner.server.Execute(p); err != nil {
		log.Error(err, "Failed to execute request")
		return
	}
}

// sendResponses listens for all the responses and sends them over the websocket connection.
func (h *RunmeHandler) sendResponses(c <-chan *v2.ExecuteResponse) {
	log := logs.FromContext(h.Ctx)
	for {
		res, ok := <-c
		if !ok {
			// The channel is closed
			log.Info("Channel to SocketProcessor closed")
			return
		}
		response := &cassie.SocketResponse{
			Payload: &cassie.SocketResponse_ExecuteResponse{
				ExecuteResponse: res,
			},
		}
		responseData, err := protojson.Marshal(response)
		if err != nil {
			log.Error(err, "Could not marshal response")
		}
		// Process the message or send a response
		err = h.Conn.WriteMessage(websocket.TextMessage, responseData)
		if err != nil {
			log.Error(err, "Could not send message")
		}
	}
}

type SocketMessageProcessor struct {
	Ctx              context.Context
	Conn             *websocket.Conn
	ExecuteRequests  chan *v2.ExecuteRequest
	ExecuteResponses chan *v2.ExecuteResponse
	// StopReading is used to signal to the readMessages goroutine that it should stop reading messages
	StopReading chan bool

	Runner *Runner
}

func (p *SocketMessageProcessor) SendMsg(m any) error {
	err := errors.New("SendMsg is not implemented")
	log := logs.FromContext(p.Ctx)
	log.Error(err, "SendMsg is not implemented")
	return err
}

func (p *SocketMessageProcessor) RecvMsg(m any) error {
	err := errors.New("RecvMsg is not implemented")
	log := logs.FromContext(p.Ctx)
	log.Error(err, "RecvMsg is not implemented")
	return err
}

func NewSocketMessageProcessor(ctx context.Context) *SocketMessageProcessor {
	p := &SocketMessageProcessor{
		Ctx: ctx,
		// Create a channel to buffer requests
		ExecuteRequests:  make(chan *v2.ExecuteRequest, 100),
		ExecuteResponses: make(chan *v2.ExecuteResponse, 100),
		StopReading:      make(chan bool, 1),
	}

	return p
}

func (p *SocketMessageProcessor) close() {
	// Close the requests channel to signal to the Runme that no more requests are expected
	close(p.ExecuteRequests)
	// We don't close the responses channel because that is closed in WebsocketHandler.execute
}

func (p *SocketMessageProcessor) Recv() (*v2.ExecuteRequest, error) {
	log := logs.FromContext(p.Ctx)

	req, ok := <-p.ExecuteRequests
	if !ok {
		log.Info("Channel closed")
		// We return io.EOF to indicate the stream is closed by the client per the grpc Bidi spec.
		return nil, io.EOF
	}
	return req, nil
}

// Send sends a response message to the client.  The server handler may
// call Send multiple times to send multiple messages to the client.  An
// error is returned if the stream was terminated unexpectedly, and the
// handler method should return, as the stream is no longer usable.
func (p *SocketMessageProcessor) Send(res *v2.ExecuteResponse) error {
	p.ExecuteResponses <- res
	return nil
}

func (p *SocketMessageProcessor) SetHeader(md metadata.MD) error {
	log := logs.FromContext(p.Ctx)
	log.Info("Set called", "md", md)
	return nil
}

func (p *SocketMessageProcessor) SendHeader(md metadata.MD) error {
	log := logs.FromContext(p.Ctx)
	log.Info("SendHeader called", "md", md)
	return nil
}

func (p *SocketMessageProcessor) SetTrailer(md metadata.MD) {
	log := logs.FromContext(p.Ctx)
	log.Info("SetTrailer called", "md", md)
}

func (p *SocketMessageProcessor) Context() context.Context {
	return p.Ctx
}
