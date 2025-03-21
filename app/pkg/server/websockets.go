package server

import (
	"context"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/pkg/errors"
	v2 "github.com/stateful/runme/v3/pkg/api/gen/proto/go/runme/runner/v2"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"io"
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
	runner *Runner
}

func (h *WebSocketHandler) Handler(w http.ResponseWriter, r *http.Request) {
	log := logs.FromContext(r.Context())
	log.Info("Handling websocket request")

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

	func() {
		defer conn.Close()

		processor := NewSocketMessageProcessor(r.Context(), conn)

		// Invoke the runme code
		// This will block until the client closes the connection
		// or Execute returns indicating the completion of Runme execution.
		if err := h.runner.server.Execute(processor); err != nil {
			log.Error(err, "Execute finished with error")
		}
	}()
	// Signal to the readMessages goroutine that it should stop reading messages
	//processor.StopReading <- true
	log.Info("Websocket request finished")
}

// SocketMessageProcessor is a processor for messages received over a websocket.
// It wraps the websocket connection in the grpc.BidiStreamingServer[ExecuteRequest, ExecuteResponse] interface
// so that we can invoke the runme code.
type SocketMessageProcessor struct {
	Ctx             context.Context
	Conn            *websocket.Conn
	ExecuteRequests chan *v2.ExecuteRequest
	// StopReading is used to signal to the readMessages goroutine that it should stop reading messages
	StopReading chan bool
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

func NewSocketMessageProcessor(ctx context.Context, conn *websocket.Conn) *SocketMessageProcessor {
	p := &SocketMessageProcessor{
		Ctx:  ctx,
		Conn: conn,
		// Create a channel to buffer requests
		ExecuteRequests: make(chan *v2.ExecuteRequest, 100),
		StopReading:     make(chan bool, 1),
	}

	// Start a goroutine to read messages from the websocket and put them on the channel
	go p.readMesages()
	return p
}

func (p *SocketMessageProcessor) readMesages() {
	log := logs.FromContext(p.Ctx)
	for {
		//// We should build our own buffer to read the message
		//var err error
		//var message []byte
		//var messageType int
		messageType, message, err := p.Conn.ReadMessage()
		if err != nil {
			log.Info("Closing ExecuteRequest channel", "err", err)
			// Close the channel.
			// This will cause Recv to return io.EOF which will signal to the Runme that no messages are expected
			close(p.ExecuteRequests)

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

		// Put the request on the channel
		p.ExecuteRequests <- req.GetExecuteRequest()
	}
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
	log := logs.FromContext(p.Ctx)
	response := &cassie.SocketResponse{
		Payload: &cassie.SocketResponse_ExecuteResponse{
			ExecuteResponse: res,
		},
	}
	responseData, err := protojson.Marshal(response)
	if err != nil {
		log.Error(err, "Could not marshal response")
		return err
	}
	// Process the message or send a response
	err = p.Conn.WriteMessage(websocket.TextMessage, responseData)
	if err != nil {
		log.Error(err, "Could not send message")
	}
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
