package stream

import (
	"context"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/iam"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/app/pkg/runme"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	v2 "github.com/runmedev/runme/v3/api/gen/proto/go/runme/runner/v2"
	"go.opentelemetry.io/otel"
	"google.golang.org/genproto/googleapis/rpc/code"
	"google.golang.org/protobuf/encoding/protojson"
)

// Multiplexer is a processor for messages received over a websocket from a single RunmeConsole element
// in the DOM.
type Multiplexer struct {
	Ctx  context.Context
	auth *iam.AuthContext

	runner  *runme.Runner
	streams *Streams

	authedSocketRequests chan *cassie.SocketRequest

	mu sync.Mutex
	// p is the processor that is currently processing messages. If p is nil then no processor is currently processing
	p *Processor
}

// NewMultiplexer creates a new Multiplexer that manages the websocket connections for a single RunmeConsole element.
func NewMultiplexer(ctx context.Context, auth *iam.AuthContext, runner *runme.Runner) *Multiplexer {
	m := &Multiplexer{
		Ctx:    ctx,
		auth:   auth,
		runner: runner,
	}

	m.authedSocketRequests = make(chan *cassie.SocketRequest, 100)
	streams := NewStreams(ctx, auth, m.authedSocketRequests)
	m.streams = streams

	return m
}

func (m *Multiplexer) acceptConnection(streamID string, sc *Connection, initialSocketRequest *cassie.SocketRequest) error {
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
func (m *Multiplexer) close() {
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
func (m *Multiplexer) process() {
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
			p = NewProcessor(ctx, req.GetRunId())
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

func (m *Multiplexer) getInflight() *Processor {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.p
}

func (m *Multiplexer) setInflight(p *Processor) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.p = p
}

// execute invokes the Runme runner to execute the request.
// It returns when the request has been processed by Runme.
func (m *Multiplexer) execute(p *Processor) {
	tracer := otel.Tracer("github.com/jlewi/cloud-assistant/app/pkg/server/websockets")
	ctx, span := tracer.Start(m.Ctx, "RunmeHandler.execute")
	defer span.End()

	// On exit we close the authedSocketRequests channel because Runme execution is finished.
	defer close(m.authedSocketRequests)
	log := logs.FromContextWithTrace(ctx)
	// Send the request to the runner
	if err := m.runner.Server.Execute(p); err != nil {
		log.Error(err, "Failed to execute request")
		return
	}
}

// broadcastResponses listens for all the responses and sends them over the websocket connection.
func (m *Multiplexer) broadcastResponses(c <-chan *v2.ExecuteResponse) {
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
