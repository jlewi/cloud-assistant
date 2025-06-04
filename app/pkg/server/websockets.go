package server

import (
	"context"
	"io"
	"net/http"
	"sync"
	"time"

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

// todo(sebastian): use everywhere?
// AuthContext encapsulates the Auth/IAM context for handlers.
type AuthContext struct {
	OIDC    *OIDC
	Checker iam.Checker
	Role    string
}

func (a *AuthContext) authorizeRequest(ctx context.Context, req *cassie.SocketRequest) error {
	log := logs.FromContextWithTrace(ctx)

	// Nil token is not fatal until authz denies access
	idToken, err := a.OIDC.verifyBearerToken(req.GetAuthorization())
	if err != nil {
		log.Info("Unauthenticated: ", "error", err)
	}

	principal, err := a.Checker.GetPrincipal(idToken)
	if err != nil {
		log.Error(err, "Could not extract principal from token")
		return ErrPrincipalExtraction
	}
	if a.Checker != nil {
		if ok := a.Checker.Check(principal, a.Role); !ok {
			log.Info("User does not have the required role", "principal", principal)
			return ErrRoleDenied
		}
	}
	return nil
}

// WebSocketHandler is a handler for websockets. A single instance is registered with the http server
// to connect websocket requests to RunmeHandlers.
type WebSocketHandler struct {
	auth *AuthContext

	runner *Runner

	mu   sync.Mutex
	runs map[string]*RunmeMultiplexer
}

func NewWebSocketHandler(runner *Runner, auth *AuthContext) *WebSocketHandler {
	return &WebSocketHandler{
		auth:   auth,
		runner: runner,
		runs:   make(map[string]*RunmeMultiplexer),
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

	streamID := r.URL.Query().Get("id")
	if streamID == "" {
		log.Error(errors.New("stream cannot be empty"), "Stream cannot be empty")
		http.Error(w, "Stream cannot be empty", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error(err, "Could not upgrade to websocket")
		http.Error(w, "Could not upgrade to websocket", http.StatusInternalServerError)
		return
	}
	sc := NewSocketConn(conn)

	multiplex, err := h.handleConnection(ctx, streamID, sc)
	if err != nil {
		log.Error(err, "Could not handle websocket connection")
		http.Error(w, "Could not handle websocket connection", http.StatusInternalServerError)
		return
	}

	// This will keep reading messages and streaming the outputs until the runme message processor is done.
	multiplex.process()
	log.Info("Websocket request finished", "streamID", streamID)
}

// handleConnection handles a websocket connection for a single stream. streamID is a uuidv4 without dashes to identify a stream.
func (h *WebSocketHandler) handleConnection(ctx context.Context, streamID string, sc *SocketConn) (*RunmeMultiplexer, error) {
	log := logs.FromContextWithTrace(ctx)

	req, err := sc.ReadSocketRequest(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "could not read socket request")
	}

	runID := req.GetRunId()
	if runID == "" {
		return nil, errors.New("run id cannot be empty")
	}
	log.Info("WebSocketHandler.handleConnection", "streamID", streamID, "runID", req.GetRunId())

	h.mu.Lock()
	defer h.mu.Unlock()

	// todo(sebastian): if we already have a run when should accept the connection
	if _, ok := h.runs[runID]; ok {
		return nil, errors.New("run already exists")
	}

	multiplex := NewRunmeMultiplexer(ctx, h.auth, h.runner)
	if err := multiplex.acceptConnection(streamID, sc, req); err != nil {
		return nil, errors.Wrap(err, "could not accept connection")
	}

	// todo(sebastian): This is temporary until we decide when to evict the run
	h.runs[runID] = multiplex

	return multiplex, nil
}

type SocketStreams struct {
	ctx  context.Context
	auth *AuthContext

	mu    sync.RWMutex
	conns map[string]*SocketConn

	authedSocketRequests chan *cassie.SocketRequest
}

func NewSocketStreams(ctx context.Context, auth *AuthContext, socketRequests chan *cassie.SocketRequest) *SocketStreams {
	return &SocketStreams{
		ctx:                  ctx,
		auth:                 auth,
		conns:                make(map[string]*SocketConn, 1),
		authedSocketRequests: socketRequests,
	}
}

// sendError sends an error message to the websocket client before closing the connection.
func (s *SocketStreams) sendError(sc *SocketConn, code code.Code, message string) {
	log := logs.FromContextWithTrace(s.ctx)

	response := &cassie.SocketResponse{
		Status: &cassie.SocketStatus{
			Code:    code,
			Message: message,
		},
	}

	err := sc.WriteSocketResponse(s.ctx, response)
	if err != nil {
		log.Error(err, "Could not send error message")
	}

	if err := sc.Close(); err != nil {
		log.Error(err, "Could not close websocket")
	}
}

func (s *SocketStreams) createStream(streamID string, sc *SocketConn, initialSocketRequest *cassie.SocketRequest) error {
	log := logs.FromContextWithTrace(s.ctx)

	if initialSocketRequest == nil {
		return errors.New("initial socket request cannot be nil")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.conns[streamID]; ok {
		return errors.New("connection already exists")
	}

	// Return early to reject the connection if the initial socket request is not authorized.
	if err := s.auth.authorizeRequest(s.ctx, initialSocketRequest); err != nil {
		log.Error(err, "Could not authorize request", "streamID", streamID, "runID", initialSocketRequest.GetRunId())
		s.sendError(sc, code.Code_PERMISSION_DENIED, err.Error())
		return err
	}

	s.authedSocketRequests <- initialSocketRequest
	s.conns[streamID] = sc

	return nil
}

func (s *SocketStreams) removeStream(streamID string) {
	log := logs.FromContextWithTrace(s.ctx)
	log.Info("Removing stream", "streamID", streamID)

	s.mu.Lock()
	defer s.mu.Unlock()

	sc, ok := s.conns[streamID]
	if !ok {
		log.Info("Stream not found", "streamID", streamID)
		return
	}

	delete(s.conns, streamID)
	_ = sc.Close()
}

func (s *SocketStreams) close() {
	log := logs.FromContextWithTrace(s.ctx)

	s.mu.Lock()
	defer s.mu.Unlock()

	for streamID, conn := range s.conns {
		delete(s.conns, streamID)
		if err := conn.Close(); err != nil {
			log.Error(err, "Could not close websocket", "streamID", streamID)
		}
	}
}

func (s *SocketStreams) receive(streamID string, sc *SocketConn) error {
	log := logs.FromContextWithTrace(s.ctx)

	for {
		log.Info("Reading socket requests", "streamID", streamID)
		req, err := sc.ReadSocketRequest(s.ctx)
		if err != nil {
			log.Error(err, "Could not read socket request")
			return err
		}

		log.Info("Received socket request", "streamID", streamID, "runID", req.GetRunId())
		if err := s.auth.authorizeRequest(s.ctx, req); err != nil {
			log.Error(err, "Could not authorize request", "streamID", streamID, "runID", req.GetRunId())
			return err
		}

		s.authedSocketRequests <- req
	}
}

func (s *SocketStreams) broadcast(responseData []byte) error {
	log := logs.FromContextWithTrace(s.ctx)
	s.mu.RLock()
	defer s.mu.RUnlock()

	for streamID, sc := range s.conns {
		log.Info("Sending response to stream", "streamID", streamID)
		err := sc.WriteMessage(websocket.TextMessage, responseData)
		if err != nil {
			log.Error(err, "Could not send message")
			return err
		}
	}

	return nil
}

// RunmeMultiplexer is a processor for messages received over a websocket from a single RunmeConsole element
// in the DOM.
//
// There is one instance of this struct per websocket connection; i.e. each instance handles a single websocket
// connection. There is also 1 websocket connection per RunmeConsole element (block) in the UI.
// So this RunmeMultiplexer is only handling one UI block. Multiple commands, including interactive ones, can be sent over
// the websocket connection. The protocol supports bidirectional streaming: the client sends an ExecuteRequest and the server
// responds with multiple ExecuteResponses. The runnerv2service.Execute method is invoked once per ExecuteRequest;
// it will terminate when execution finishes.
// However, the UI could send additional ExecuteRequests over the same websocket connection. These could
// be a stop/terminate message to indicate we should abort a long running command.
//
// However, we should also be robust to the case where the UI erroneously sends a new request before the current one
// has finished.
type RunmeMultiplexer struct {
	Ctx  context.Context
	auth *AuthContext

	runner  *Runner
	streams *SocketStreams

	authedSocketRequests chan *cassie.SocketRequest

	mu sync.Mutex
	// p is the processor that is currently processing messages. If p is nil then no processor is currently processing
	p *RunmeMessageProcessor
}

func NewRunmeMultiplexer(ctx context.Context, auth *AuthContext, runner *Runner) *RunmeMultiplexer {
	m := &RunmeMultiplexer{
		Ctx:    ctx,
		auth:   auth,
		runner: runner,
	}

	m.authedSocketRequests = make(chan *cassie.SocketRequest, 100)
	streams := NewSocketStreams(ctx, auth, m.authedSocketRequests)
	m.streams = streams

	return m
}

func (m *RunmeMultiplexer) acceptConnection(streamID string, sc *SocketConn, initialSocketRequest *cassie.SocketRequest) error {
	log := logs.FromContextWithTrace(m.Ctx)

	if err := m.streams.createStream(streamID, sc, initialSocketRequest); err != nil {
		log.Error(err, "Could not create stream")
		return err
	}

	go func() {
		defer m.streams.removeStream(streamID)

		if err := m.streams.receive(streamID, sc); err != nil {
			closeErr, ok := err.(*websocket.CloseError)
			if !ok {
				log.Error(err, "Unexpected error while receiving socket requests")
				return
			}

			log.Info("Connection closed", "streamID", streamID, "closeCode", closeErr.Code, "closeText", closeErr.Error())
		}
	}()

	return nil
}

// close shuts down the RunmeMultiplexer
func (m *RunmeMultiplexer) close() {
	p := m.getInflight()
	if p != nil {
		p.close()
	}
	m.setInflight(nil)
	// Wait for 30s to give the client a chance to close the connection.
	time.Sleep(30 * time.Second)
	// With Runme's execution finished we can close all websocket connections.
	m.streams.close()
}

// process reads messages from the websocket connection and puts them on the ExecuteRequests channel.
func (m *RunmeMultiplexer) process() {
	tracer := otel.Tracer("github.com/jlewi/cloud-assistant/app/pkg/server/websockets")
	ctx, span := tracer.Start(m.Ctx, "RunmeMultiplexer.process")
	defer span.End()
	log := logs.FromContextWithTrace(ctx)

	// When the authedSocketRequests channel closes Runme finished executing the command.
	defer m.close()

	for {
		req, ok := <-m.authedSocketRequests
		if !ok {
			log.Info("Closing authedSocketRequests channel")
			return
		}

		if req.GetExecuteRequest() == nil {
			log.Info("Received message doesn't contain an ExecuteRequest")
			continue
		}

		// todo(sebastian): Still have to decide what to do if a user tries to send a new request before the current's done as below
		p := m.getInflight()
		if p == nil {
			p = NewRunmeMessageProcessor(ctx, req.GetRunId())
			m.setInflight(p)
			go m.execute(p)

			// start a separate goroutine to broadcast responses to all clients
			go m.broadcastResponses(p.ExecuteResponses)
		}
		// TODO(jlewi): What should we do if a user tries to send a new request before the current one has finished?
		// How can we detect if its a new request? Should we check if anything other than a "Stop" request is sent
		// after the first request? Right now we are just passing it along to RunME. Hopefully, RunMe handles it.

		// Put the request on the channel
		// Access the local variable to ensure its always set at this point and avoid race conditions.
		p.ExecuteRequests <- req.GetExecuteRequest()
	}
}

func (m *RunmeMultiplexer) getInflight() *RunmeMessageProcessor {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.p
}

func (m *RunmeMultiplexer) setInflight(p *RunmeMessageProcessor) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.p = p
}

// execute invokes the Runme runner to execute the request.
// It returns when the request has been processed by Runme.
func (m *RunmeMultiplexer) execute(p *RunmeMessageProcessor) {
	tracer := otel.Tracer("github.com/jlewi/cloud-assistant/app/pkg/server/websockets")
	ctx, span := tracer.Start(m.Ctx, "RunmeHandler.execute")
	defer span.End()

	// On exit we close the authedSocketRequests channel because Runme execution is finished.
	defer close(m.authedSocketRequests)
	log := logs.FromContextWithTrace(ctx)
	// Send the request to the runner
	if err := m.runner.server.Execute(p); err != nil {
		log.Error(err, "Failed to execute request")
		return
	}
}

// broadcastResponses listens for all the responses and sends them over the websocket connection.
func (m *RunmeMultiplexer) broadcastResponses(c <-chan *v2.ExecuteResponse) {
	log := logs.FromContextWithTrace(m.Ctx)
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

		if err := m.streams.broadcast(responseData); err != nil {
			log.Error(err, "Could not broadcast response")
		}
	}
}

type RunmeMessageProcessor struct {
	Ctx              context.Context
	RunID            string
	ExecuteRequests  chan *v2.ExecuteRequest
	ExecuteResponses chan *v2.ExecuteResponse
	// StopReading is used to signal to the readMessages goroutine that it should stop reading messages
	StopReading chan bool

	Runner *Runner
}

func (p *RunmeMessageProcessor) SendMsg(m any) error {
	err := errors.New("SendMsg is not implemented")
	log := logs.FromContextWithTrace(p.Ctx)
	log.Error(err, "SendMsg is not implemented")
	return err
}

func (p *RunmeMessageProcessor) RecvMsg(m any) error {
	err := errors.New("RecvMsg is not implemented")
	log := logs.FromContextWithTrace(p.Ctx)
	log.Error(err, "RecvMsg is not implemented")
	return err
}

func NewRunmeMessageProcessor(ctx context.Context, runID string) *RunmeMessageProcessor {
	p := &RunmeMessageProcessor{
		Ctx:   ctx,
		RunID: runID,
		// Create a channel to buffer requests
		ExecuteRequests:  make(chan *v2.ExecuteRequest, 100),
		ExecuteResponses: make(chan *v2.ExecuteResponse, 100),
		StopReading:      make(chan bool, 1),
	}

	return p
}

func (p *RunmeMessageProcessor) close() {
	// Close the requests channel to signal to the Runme that no more requests are expected
	close(p.ExecuteRequests)
	// Close the responses channel to signal to the Runme that no more responses are expected
	close(p.ExecuteResponses)
}

func (p *RunmeMessageProcessor) Recv() (*v2.ExecuteRequest, error) {
	log := logs.FromContextWithTrace(p.Ctx)

	req, ok := <-p.ExecuteRequests
	if !ok {
		log.Info("Channel closed", "runID", p.RunID)
		// We return io.EOF to indicate the stream is closed by the client per the grpc Bidi spec.
		return nil, io.EOF
	}
	return req, nil
}

// Send sends a response message to the client.  The server handler may
// call Send multiple times to send multiple messages to the client.  An
// error is returned if the stream was terminated unexpectedly, and the
// handler method should return, as the stream is no longer usable.
func (p *RunmeMessageProcessor) Send(res *v2.ExecuteResponse) error {
	p.ExecuteResponses <- res
	return nil
}

func (p *RunmeMessageProcessor) SetHeader(md metadata.MD) error {
	log := logs.FromContextWithTrace(p.Ctx)
	log.Info("Set called", "md", md, "runID", p.RunID)
	return nil
}

func (p *RunmeMessageProcessor) SendHeader(md metadata.MD) error {
	log := logs.FromContextWithTrace(p.Ctx)
	log.Info("SendHeader called", "md", md, "runID", p.RunID)
	return nil
}

func (p *RunmeMessageProcessor) SetTrailer(md metadata.MD) {
	log := logs.FromContextWithTrace(p.Ctx)
	log.Info("SetTrailer called", "md", md, "runID", p.RunID)
}

func (p *RunmeMessageProcessor) Context() context.Context {
	return p.Ctx
}

// SocketConn is a thin wrapper around *websocket.Conn for reading/writing SocketRequest/SocketResponse.
type SocketConn struct {
	conn *websocket.Conn
}

// NewSocketConn creates a new SocketConn from a websocket connection.
func NewSocketConn(conn *websocket.Conn) *SocketConn {
	return &SocketConn{conn: conn}
}

// Close closes the websocket connection.
func (sc *SocketConn) Close() error {
	return sc.conn.Close()
}

// ReadSocketRequest reads a SocketRequest from the websocket connection.
func (sc *SocketConn) ReadSocketRequest(ctx context.Context) (*cassie.SocketRequest, error) {
	return readSocketMessage(ctx, sc.conn, func() *cassie.SocketRequest { return &cassie.SocketRequest{} })
}

// ReadSocketResponse reads a SocketResponse from the websocket connection.
func (sc *SocketConn) ReadSocketResponse(ctx context.Context) (*cassie.SocketResponse, error) {
	return readSocketMessage(ctx, sc.conn, func() *cassie.SocketResponse { return &cassie.SocketResponse{} })
}

// WriteSocketResponse writes a SocketResponse to the websocket connection as a TextMessage.
func (sc *SocketConn) WriteSocketResponse(ctx context.Context, resp *cassie.SocketResponse) error {
	log := logs.FromContextWithTrace(ctx)
	data, err := protojson.Marshal(resp)
	if err != nil {
		log.Error(err, "Could not marshal SocketResponse")
		return err
	}
	if err := sc.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Error(err, "Could not write SocketResponse")
		return err
	}
	return nil
}

// WriteMessage writes a message to the websocket connection.
func (sc *SocketConn) WriteMessage(messageType int, data []byte) error {
	return sc.conn.WriteMessage(messageType, data)
}

// readWebsocketMessage reads messages from the websocket connection and returns the message type and the message content.
func readWebsocketMessage(ctx context.Context, conn *websocket.Conn) (int, []byte, error) {
	log := logs.FromContextWithTrace(ctx)
	messageType, message, err := conn.ReadMessage()
	if err != nil {
		closeErr, ok := err.(*websocket.CloseError)
		if !ok {
			// For now assume unexpected errors are fatal and we should terminate the request.
			// This way at least they will be noticeable and we can see if it makes sense to try to keep going
			log.Error(err, "Could not read message")
			return 0, nil, err
		}
		log.Info("Connection closed", "closeCode", closeErr.Code, "closeText", closeErr.Error())
		return 0, nil, err
	}
	return messageType, message, nil
}

// readSocketMessage reads a socket message from the websocket connection and unmarshals it into the provided proto.Message type.
func readSocketMessage[T proto.Message](ctx context.Context, conn *websocket.Conn, newT func() T) (T, error) {
	log := logs.FromContextWithTrace(ctx)
	messageType, message, err := readWebsocketMessage(ctx, conn)
	if err != nil {
		log.Error(err, "Could not read socket message")
		var zero T
		return zero, err
	}
	return unmarshalSocketMessage(ctx, messageType, message, newT)
}

// unmarshalSocketMessage unmarshals the websocket message into the provided proto.Message type.
func unmarshalSocketMessage[T proto.Message](ctx context.Context, messageType int, message []byte, newT func() T) (T, error) {
	log := logs.FromContextWithTrace(ctx)
	msg := newT()

	switch messageType {
	case websocket.TextMessage:
		if err := protojson.Unmarshal(message, msg); err != nil {
			var zero T
			return zero, errors.Wrap(err, "Could not unmarshal message as TextMessage")
		}
		log.Info("Received message", "message", msg)
	case websocket.BinaryMessage:
		if err := proto.Unmarshal(message, msg); err != nil {
			var zero T
			return zero, errors.Wrap(err, "Could not unmarshal message as BinaryMessage")
		}
		log.Info("Received message", "message", msg)
	default:
		var zero T
		return zero, errors.Errorf("Unsupported message type: %d", messageType)
	}
	return msg, nil
}
