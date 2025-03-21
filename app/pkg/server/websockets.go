package server

import (
	"context"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	v2 "github.com/stateful/runme/v3/pkg/api/gen/proto/go/runme/runner/v2"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"net/http"
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
}

func (h *WebSocketHandler) Handler(w http.ResponseWriter, r *http.Request) {
	log := logs.FromContext(r.Context())
	log.Info("Handling websocket request")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error(err, "Could not upgrade to websocket")
		http.Error(w, "Could not upgrade to websocket", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Error(err, "Could not read message")
			break
		}

		req := &cassie.SocketRequest{}

		switch messageType {
		case websocket.TextMessage:
			// Parse the message
			if err := protojson.Unmarshal(message, req); err != nil {
				log.Error(err, "Could not unmarshal message as SocketRequest")
				break
			}
			log.Info("Received message", "message", req)
		case websocket.BinaryMessage:
			// Parse the message
			if err := proto.Unmarshal(message, req); err != nil {
				log.Error(err, "Could not unmarshal message as SocketRequest")
				break
			}
			log.Info("Received message", "message", req)
		default:
			log.Error(nil, "Unsupported message type", "messageType", messageType)
		}

		// Process the message or send a response
		err = conn.WriteMessage(messageType, message)
		if err != nil {
			break
		}
	}
}

// SocketMessageProcessor is a processor for messages received over a websocket.
// It wraps the websocket connection in the grpc.BidiStreamingServer[ExecuteRequest, ExecuteResponse] interface
// so that we can invoke the runme code.
type SocketMessageProcessor struct {
	Ctx  context.Context
	Conn *websocket.Conn
}

func (p *SocketMessageProcessor) Recv() (*v2.ExecuteRequest, error) {
	log := logs.FromContext(p.Ctx)
	for {
		// We should build our own buffer to read the message
		messageType, message, err := p.Conn.ReadMessage()
		if err != nil {
			log.Error(err, "Could not read message")
			break
		}

		req := &cassie.SocketRequest{}

		switch messageType {
		case websocket.TextMessage:
			// Parse the message
			if err := protojson.Unmarshal(message, req); err != nil {
				log.Error(err, "Could not unmarshal message as SocketRequest")
				break
			}
			log.Info("Received message", "message", req)
		case websocket.BinaryMessage:
			// Parse the message
			if err := proto.Unmarshal(message, req); err != nil {
				log.Error(err, "Could not unmarshal message as SocketRequest")
				break
			}
			log.Info("Received message", "message", req)
		default:
			log.Error(nil, "Unsupported message type", "messageType", messageType)
		}

		// Process the message or send a response
		err = p.Conn.WriteMessage(messageType, message)
		if err != nil {
			break
		}
	}

	return nil, nil
}

// Send sends a response message to the client.  The server handler may
// call Send multiple times to send multiple messages to the client.  An
// error is returned if the stream was terminated unexpectedly, and the
// handler method should return, as the stream is no longer usable.
func (p *SocketMessageProcessor) Send(res *v2.ExecuteRequest) error {
	return nil
}
