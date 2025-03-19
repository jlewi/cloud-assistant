package server

import (
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"net/http"
)

var upgrader = websocket.Upgrader{
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
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Could not upgrade to websocket", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		log.Info("Received message", "message", string(message))

		// Process the message or send a response
		err = conn.WriteMessage(messageType, message)
		if err != nil {
			break
		}
	}
}
