package server

import (
	"context"
	"io"
	"net/http"
	"sync"

	"google.golang.org/genproto/googleapis/rpc/code"

	"github.com/go-logr/logr"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/iam"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	v2 "github.com/runmedev/runme/v3/api/gen/proto/go/runme/runner/v2"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// Add error variables at the top of the file
var (
	ErrPrincipalExtraction = errors.New("could not extract principal from token")
	ErrRoleDenied          = errors.New("user does not have the required role")
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

// WebSocketHandler is a handler for websockets. A single instance is registered with the http server
// to connect websocket requests to RunmeHandlers.
type WebSocketHandler struct {
	runner *Runner

	oidc    *OIDC
	checker iam.Checker
	role    string
}

func NewWebSocketHandler(runner *Runner, oidc *OIDC, checker iam.Checker, role string) *WebSocketHandler {
	return &WebSocketHandler{
		runner:  runner,
		oidc:    oidc,
		checker: checker,
		role:    role,
	}
}

func (h *WebSocketHandler) Handler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	log := logs.FromContextWithTrace(ctx)
	ctx = logr.NewContext(ctx, log)
	log.Info("WebsocketHandler.Handler")

	if h.runner.server == nil {
		log.Error(errors.New("Runner server is nil"), "Runner server is nil")
		http.Error(w, "Runner server is nil; server is not properly configured", http.StatusInternalServerError)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error(err, "Could not upgrade to websocket")
		http.Error(w, "Could not upgrade to websocket", http.StatusInternalServerError)
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			log.Error(err, "Could not close websocket")
		}
	}()
	processor := NewRunmeHandler(ctx, conn, h.runner, h.oidc, h.checker, h.role)

	// This will keep reading messages and streaming the outputs until the connection is closed.
	processor.receive()
	log.Info("Websocket request finished")
}

// RunmeHandler is a processor for messages received over a websocket from a single RunmeConsole element
// in the DOM.
//
// There is one instance of this struct per websocket connection; i.e. each instance handles a single websocket
// connection. There is also 1 websocket connection per RunmeConsole element (block) in the UI.
// So this RunmeHandler is only handling one UI block. Multiple commands, including interactive ones, can be sent over
// the websocket connection. The protocol supports bidirectional streaming: the client sends an ExecuteRequest and the server
// responds with multiple ExecuteResponses. The runnerv2service.Execute method is invoked once per ExecuteRequest;
// it will terminate when execution finishes.
// However, the UI could send additional ExecuteRequests over the same websocket connection. These could
// be a stop/terminate message to indicate we should abort a long running command.
//
// However, we should also be robust to the case where the UI erroneously sends a new request before the current one
// has finished.
type RunmeHandler struct {
	Ctx    context.Context
	Conn   *websocket.Conn
	Runner *Runner

	oidc    *OIDC
	checker iam.Checker
	role    string

	mu sync.Mutex
	// p is the processor that is currently processing messages. If p is nil then no processor is currently processing
	p *SocketMessageProcessor
}

func NewRunmeHandler(ctx context.Context, conn *websocket.Conn, runner *Runner, oidc *OIDC, checker iam.Checker, role string) *RunmeHandler {
	return &RunmeHandler{
		Ctx:     ctx,
		Conn:    conn,
		Runner:  runner,
		oidc:    oidc,
		checker: checker,
		role:    role,
	}
}

// receive reads messages from the websocket connection and puts them on the ExecuteRequests channel.
func (h *RunmeHandler) receive() {
	tracer := otel.Tracer("github.com/jlewi/cloud-assistant/app/pkg/server/websockets")
	ctx, span := tracer.Start(h.Ctx, "RunmeHandler.receive")
	defer span.End()
	log := logs.FromContextWithTrace(ctx)

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

		req, err := h.unmarshalSocketRequest(messageType, message)
		if err != nil {
			// todo(sebastian): should we send an error to the client instead?
			log.Error(err, "Could not parse SocketRequest")
			continue
		}

		// Make sure the request is authorized
		err = h.authorizeRequest(req)
		if err != nil {
			h.sendError(code.Code_PERMISSION_DENIED, err.Error())
			return
		}

		if req.GetExecuteRequest() == nil {
			log.Info("Received message doesn't contain an ExecuteRequest")
			continue
		}

		p := h.getInflight()
		if p == nil {
			p = NewSocketMessageProcessor(ctx)
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

// unmarshalSocketRequest unmarshals the Connect message into a SocketRequest
func (h *RunmeHandler) unmarshalSocketRequest(messageType int, message []byte) (*cassie.SocketRequest, error) {
	log := logs.FromContextWithTrace(h.Ctx)

	req := &cassie.SocketRequest{}

	switch messageType {
	case websocket.TextMessage:
		// Parse the message
		if err := protojson.Unmarshal(message, req); err != nil {
			return nil, errors.Wrap(err, "Could not unmarshal message as SocketRequest (TextMessage)")
		}
		log.Info("Received message", "message", req)
	case websocket.BinaryMessage:
		// Parse the message
		if err := proto.Unmarshal(message, req); err != nil {
			return nil, errors.Wrap(err, "Could not unmarshal message as SocketRequest (BinaryMessage)")
		}
		log.Info("Received message", "message", req)
	default:
		return nil, errors.Errorf("Unsupported message type: %d", messageType)
	}
	return req, nil
}

func (h *RunmeHandler) authorizeRequest(req *cassie.SocketRequest) error {
	log := logs.FromContextWithTrace(h.Ctx)

	// Nil token is not fatal until authz denies access
	idToken, err := h.oidc.verifyBearerToken(req.GetAuthorization())
	if err != nil {
		log.Info("Unauthenticated: ", "error", err)
	}

	principal, err := h.checker.GetPrincipal(idToken)
	if err != nil {
		log.Error(err, "Could not extract principal from token")
		return ErrPrincipalExtraction
	}
	if h.checker != nil {
		if ok := h.checker.Check(principal, h.role); !ok {
			log.Info("User does not have the required role", "principal", principal)
			return ErrRoleDenied
		}
	}
	return nil
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
	tracer := otel.Tracer("github.com/jlewi/cloud-assistant/app/pkg/server/websockets")
	ctx, span := tracer.Start(h.Ctx, "RunmeHandler.execute")
	defer span.End()
	log := logs.FromContextWithTrace(ctx)
	defer h.setInflight(nil)
	// On exit we close the executeResponses channel because no more responses are expected from runme.
	defer close(p.ExecuteResponses)
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
			Status: &cassie.SocketStatus{
				Code: code.Code_OK,
			},
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

func (h *RunmeHandler) sendError(code code.Code, message string) {
	log := logs.FromContext(h.Ctx)

	defer func() {
		if err := h.Conn.Close(); err != nil {
			log.Error(err, "Could not close websocket")
		}
	}()

	response := &cassie.SocketResponse{
		Status: &cassie.SocketStatus{
			Code:    code,
			Message: message,
		},
	}

	responseData, err := protojson.Marshal(response)
	if err != nil {
		log.Error(err, "Could not marshal response")
	}

	err = h.Conn.WriteMessage(websocket.TextMessage, responseData)
	if err != nil {
		log.Error(err, "Could not send error message")
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
