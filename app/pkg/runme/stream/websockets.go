package stream

import (
	"context"
	"net/http"
	"sync"

	"github.com/go-logr/logr"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/iam"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/app/pkg/runme"
	"github.com/pkg/errors"
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
	auth *iam.AuthContext

	runner *runme.Runner

	mu   sync.Mutex
	runs map[string]*RunmeMultiplexer
}

func NewWebSocketHandler(runner *runme.Runner, auth *iam.AuthContext) *WebSocketHandler {
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

	if h.runner.Server == nil {
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
	sc := NewStreamConn(conn)

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
func (h *WebSocketHandler) handleConnection(ctx context.Context, streamID string, sc *StreamConn) (*RunmeMultiplexer, error) {
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
