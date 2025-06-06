package stream

import (
	"context"

	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// StreamConn is a thin wrapper around *websocket.Conn for reading/writing SocketRequest/SocketResponse.
type StreamConn struct {
	conn *websocket.Conn
}

// NewStreamConn creates a new StreamConn from a websocket connection.
func NewStreamConn(conn *websocket.Conn) *StreamConn {
	return &StreamConn{conn: conn}
}

// Close closes the websocket connection.
func (sc *StreamConn) Close() error {
	return sc.conn.Close()
}

// ReadSocketRequest reads a SocketRequest from the websocket connection.
func (sc *StreamConn) ReadSocketRequest(ctx context.Context) (*cassie.SocketRequest, error) {
	return readSocketMessage(ctx, sc.conn, func() *cassie.SocketRequest { return &cassie.SocketRequest{} })
}

// ReadSocketResponse reads a SocketResponse from the websocket connection.
func (sc *StreamConn) ReadSocketResponse(ctx context.Context) (*cassie.SocketResponse, error) {
	return readSocketMessage(ctx, sc.conn, func() *cassie.SocketResponse { return &cassie.SocketResponse{} })
}

// WriteSocketResponse writes a SocketResponse to the websocket connection as a TextMessage.
func (sc *StreamConn) WriteSocketResponse(ctx context.Context, resp *cassie.SocketResponse) error {
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
func (sc *StreamConn) WriteMessage(messageType int, data []byte) error {
	return sc.conn.WriteMessage(messageType, data)
}

// readWebsocketMessage reads messages from the websocket connection and returns the message type and the message content.
func readWebsocketMessage(ctx context.Context, conn *websocket.Conn) (int, []byte, error) {
	log := logs.FromContextWithTrace(ctx)
	messageType, message, err := conn.ReadMessage()
	if err != nil {
		closeErr, ok := err.(*websocket.CloseError)
		if !ok {
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
