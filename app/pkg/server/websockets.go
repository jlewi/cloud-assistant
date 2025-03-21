package server

import (
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
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

		case websocket.BinaryMessage:
		}
		log.Info("Received message", "message", string(message))

		// Process the message or send a response
		err = conn.WriteMessage(messageType, message)
		if err != nil {
			break
		}
	}
}
