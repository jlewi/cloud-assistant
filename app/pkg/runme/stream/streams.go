package stream

import (
	"context"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/iam"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	"google.golang.org/genproto/googleapis/rpc/code"
)

// Streams manages multiple websocket connections attached to a muliplexed Runme execution.
type Streams struct {
	ctx  context.Context
	auth *iam.AuthContext

	mu    sync.RWMutex
	conns map[string]*Connection

	authedSocketRequests chan *cassie.SocketRequest
}

// NewStreams creates a instance of Streams that manages multiple websocket connections attached to a muliplexed Runme execution.
func NewStreams(ctx context.Context, auth *iam.AuthContext, socketRequests chan *cassie.SocketRequest) *Streams {
	return &Streams{
		ctx:                  ctx,
		auth:                 auth,
		conns:                make(map[string]*Connection, 1),
		authedSocketRequests: socketRequests,
	}
}

func (s *Streams) createStream(streamID string, sc *Connection) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.conns[streamID]; ok {
		return errors.New("connection already exists")
	}

	s.conns[streamID] = sc

	return nil
}

func (s *Streams) removeStream(streamID string) {
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

func (s *Streams) close() {
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

func (s *Streams) receive(streamID string, sc *Connection) error {
	log := logs.FromContextWithTrace(s.ctx)

	for {
		log.Info("Reading socket requests", "streamID", streamID)
		req, err := sc.ReadSocketRequest(s.ctx)
		if err != nil {
			log.Error(err, "Could not read socket request")
			return err
		}

		log.Info("Received socket request", "streamID", streamID, "runID", req.GetRunId())
		// Return error to reject the connection if the socket request is not authorized.
		if err := s.auth.AuthorizeRequest(s.ctx, req); err != nil {
			log.Error(err, "Could not authorize request", "streamID", streamID, "runID", req.GetRunId())
			sc.ErrorMessage(s.ctx, code.Code_PERMISSION_DENIED, "Unauthorized request")
			return err
		}

		// Only authorized requests are forwarded to the multiplexer.
		s.authedSocketRequests <- req
	}
}

func (s *Streams) broadcast(responseData []byte) error {
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
