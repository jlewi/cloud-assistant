package stream

import (
	"context"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	"google.golang.org/genproto/googleapis/rpc/code"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// Connection is a thin wrapper around *websocket.Conn for common SocketRequest/SocketResponse operations.
type Connection struct {
	conn *websocket.Conn

	readerMu sync.Mutex // protects reading from the websocket
	writerMu sync.Mutex // protects writing to the websocket
}

// NewConnection creates a new Connection from a websocket connection.
func NewConnection(conn *websocket.Conn) *Connection {
	return &Connection{conn: conn}
}

// Close closes the websocket connection.
func (sc *Connection) Close() error {
	return sc.conn.Close()
}

// Error closes the connection with a protocol error; details are in the message.
func (sc *Connection) Error(message string) error {
	const timeout = 10 * time.Second
	// The websocket is treated as a transport which is why app-level errors are protocol errors.
	const closeCode = websocket.CloseProtocolError
	return sc.conn.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(closeCode, message),
		time.Now().Add(timeout),
	)
}

// ErrorMessage sends an error to the websocket client before closing the connection.
func (sc *Connection) ErrorMessage(ctx context.Context, code code.Code, message string) {
	log := logs.FromContextWithTrace(ctx)

	response := &cassie.SocketResponse{
		Status: &cassie.SocketStatus{
			Code:    code,
			Message: message,
		},
	}

	err := sc.WriteSocketResponse(ctx, response)
	if err != nil {
		log.Error(err, "Could not send error message")
	}

	if err := sc.Error(message); err != nil {
		log.Error(err, "Could not close websocket with error")
	}
}

// ReadSocketRequest reads a SocketRequest from the websocket connection.
func (sc *Connection) ReadSocketRequest(ctx context.Context) (*cassie.SocketRequest, error) {
	sc.readerMu.Lock()
	defer sc.readerMu.Unlock()
	return readSocketMessage(ctx, sc.conn, func() *cassie.SocketRequest { return &cassie.SocketRequest{} })
}

// ReadSocketResponse reads a SocketResponse from the websocket connection.
func (sc *Connection) ReadSocketResponse(ctx context.Context) (*cassie.SocketResponse, error) {
	sc.readerMu.Lock()
	defer sc.readerMu.Unlock()
	return readSocketMessage(ctx, sc.conn, func() *cassie.SocketResponse { return &cassie.SocketResponse{} })
}

// WriteSocketResponse writes a SocketResponse to the websocket connection as a TextMessage.
func (sc *Connection) WriteSocketResponse(ctx context.Context, resp *cassie.SocketResponse) error {
	log := logs.FromContextWithTrace(ctx)
	data, err := protojson.Marshal(resp)
	if err != nil {
		log.Error(err, "Could not marshal SocketResponse")
		return err
	}
	return sc.WriteMessage(websocket.TextMessage, data)
}

// WriteMessage writes a message to the websocket connection.
func (sc *Connection) WriteMessage(messageType int, data []byte) error {
	sc.writerMu.Lock()
	defer sc.writerMu.Unlock()
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
		log.Info("Received message", "messageType", messageType, "messageLength", len(message))
	case websocket.BinaryMessage:
		if err := proto.Unmarshal(message, msg); err != nil {
			var zero T
			return zero, errors.Wrap(err, "Could not unmarshal message as BinaryMessage")
		}
		log.Info("Received message", "messageType", messageType, "messageLength", len(message))
	default:
		var zero T
		return zero, errors.Errorf("Unsupported message type: %d", messageType)
	}
	return msg, nil
}
