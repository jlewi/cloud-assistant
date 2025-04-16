package server

import (
	"connectrpc.com/connect"
	"connectrpc.com/grpchealth"
	"github.com/jlewi/cloud-assistant/app/pkg/ai"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie/cassieconnect"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"context"
	"fmt"

	"connectrpc.com/otelconnect"

	"github.com/go-logr/zapr"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/pkg/errors"

	runnerv2 "github.com/runmedev/runme/v3/pkg/api/gen/proto/go/runme/runner/v2"

	//"github.com/runmedev/runme/v3/pkg/api/gen/proto/go/runme/runner/v2/runnerv2connect"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"
)

// Server is the main server for the cloud assistant
type Server struct {
	telemetry        *config.TelemetryConfig
	serverConfig     *config.AssistantServerConfig
	hServer          *http.Server
	engine           http.Handler
	shutdownComplete chan bool
	runner           *Runner
	agent            *ai.Agent
}

type Options struct {
	Telemetry *config.TelemetryConfig
	Server    *config.AssistantServerConfig
}

// NewServer creates a new server
func NewServer(opts Options, agent *ai.Agent) (*Server, error) {
	log := zapr.NewLogger(zap.L())
	if agent == nil {
		if !opts.Server.RunnerService {
			return nil, errors.New("Agent and Runner service are both disabled")
		}
		log.Info("Agent is nil; continuing without AI service")
	}

	var runner *Runner

	if opts.Server.RunnerService {
		var err error
		runner, err = NewRunner(zap.L())
		if err != nil {
			return nil, err
		}
		ctx := context.Background()
		session, err := runner.server.CreateSession(ctx, &runnerv2.CreateSessionRequest{
			Project: &runnerv2.Project{
				Root:         ".",
				EnvLoadOrder: []string{".env", ".env.local", ".env.development", ".env.dev"},
			},
			Config: &runnerv2.CreateSessionRequest_Config{
				EnvStoreSeeding: runnerv2.CreateSessionRequest_Config_SESSION_ENV_STORE_SEEDING_SYSTEM.Enum(),
			},
		})
		if err != nil {
			return nil, err
		}
		log.Info("Runner session created", "sessionID", session.GetSession().GetId())
	} else {
		log.Info("Runner service is disabled")
	}

	s := &Server{
		telemetry:    opts.Telemetry,
		serverConfig: opts.Server,
		runner:       runner,
		agent:        agent,
	}
	return s, nil
}

// Run starts the http server
// Blocks until its shutdown.
func (s *Server) Run() error {
	s.shutdownComplete = make(chan bool, 1)
	trapInterrupt(s)

	log := zapr.NewLogger(zap.L())

	// Register the services
	if err := s.registerServices(); err != nil {
		return errors.Wrapf(err, "Failed to register services")
	}

	serverConfig := s.serverConfig
	if serverConfig == nil {
		serverConfig = &config.AssistantServerConfig{}
	}

	address := fmt.Sprintf("%s:%d", serverConfig.GetBindAddress(), serverConfig.GetPort())
	log.Info("Starting http server", "address", address)

	// N.B. We don't use an http2 server because we are using websockets and we were having some issues with
	// http2. Without http2 I'm not sure we can serve grpc.
	hServer := &http.Server{
		// Set timeouts to 0 to disable them because we are using websockets
		WriteTimeout: 0,
		ReadTimeout:  0,
		// We need to wrap it in h2c to support HTTP/2 without TLS
		Handler: h2c.NewHandler(s.engine, &http2.Server{}),
	}
	// Enable HTTP/2 support
	if err := http2.ConfigureServer(hServer, &http2.Server{}); err != nil {
		return errors.Wrapf(err, "failed to configure http2 server")
	}

	s.hServer = hServer

	lis, err := net.Listen("tcp", address)

	if err != nil {
		return errors.Wrapf(err, "Could not start listener")
	}
	go func() {
		if err := hServer.Serve(lis); err != nil {
			if !errors.Is(err, http.ErrServerClosed) {
				log.Error(err, "There was an error with the http server")
			}
		}
	}()

	// Wait for the shutdown to complete
	// We use a channel to signal when the shutdown method has completed and then return.
	// This is necessary because shutdown() is running in a different go function from hServer.Serve. So if we just
	// relied on hServer.Serve to return and then returned from Run we might still be in the middle of calling shutdown.
	// That's because shutdown calls hServer.Shutdown which causes hserver.Serve to return.
	<-s.shutdownComplete
	return nil
}

func (s *Server) registerServices() error {
	log := zapr.NewLogger(zap.L())

	// Create auth mux
	mux, err := NewAuthMux(s.serverConfig)
	if err != nil {
		return errors.Wrapf(err, "Failed to create auth mux")
	}

	// Create the OTEL interceptor
	otelInterceptor, err := otelconnect.NewInterceptor()
	if err != nil {
		return errors.Wrapf(err, "Failed to create otel interceptor")
	}

	interceptors := []connect.Interceptor{otelInterceptor}

	origins := s.serverConfig.CorsOrigins
	if len(origins) == 0 {
		log.Info("No additional CORS origins specified for protected routes")
	} else {
		log.Info("Adding CORS support for protected routes", "origins", origins)
	}

	// Register auth routes if OIDC is configured
	if s.serverConfig.OIDC != nil {
		if err := RegisterAuthRoutes(s.serverConfig.OIDC, mux); err != nil {
			return errors.Wrapf(err, "Failed to register auth routes")
		}
	}

	if s.agent != nil {
		aiSvcPath, aiSvcHandler := cassieconnect.NewBlocksServiceHandler(s.agent, connect.WithInterceptors(interceptors...))
		log.Info("Setting up AI service", "path", aiSvcPath)
		// Protect the AI service
		mux.HandleProtected(aiSvcPath, aiSvcHandler)
	} else {
		log.Info("Agent is nil; AI service is disabled")
	}

	if s.runner != nil {
		sHandler := &WebSocketHandler{
			runner: s.runner,
		}
		// Protect the WebSocket handler
		mux.HandleProtected("/ws", http.HandlerFunc(sHandler.Handler))
		log.Info("Setting up runner service", "path", "/ws")
	}

	// Health check should be public
	checker := grpchealth.NewStaticChecker()
	mux.Handle(grpchealth.NewHandler(checker))

	// Handle the single page app and assets unprotected
	singlePageApp, err := s.singlePageAppHandler()
	if err != nil {
		return errors.Wrapf(err, "Failed to serve single page app")
	}
	mux.Handle("/", singlePageApp)

	s.engine = mux

	return nil
}

func (s *Server) shutdown() {
	log := zapr.NewLogger(zap.L())
	log.Info("Shutting down the cloud-assistant server")

	if s.hServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := s.hServer.Shutdown(ctx); err != nil {
			log.Error(err, "Error shutting down http server")
		}
		log.Info("HTTP Server shutdown complete")
	}
	log.Info("Shutdown complete")
	s.shutdownComplete <- true
}

// trapInterrupt shutdowns the server if the appropriate signals are sent
func trapInterrupt(s *Server) {
	log := zapr.NewLogger(zap.L())
	sigs := make(chan os.Signal, 10)
	// Note SIGSTOP and SIGTERM can't be caught
	// We can trap SIGINT which is what ctl-z sends to interrupt the process
	// to interrupt the process
	signal.Notify(sigs, syscall.SIGINT)

	go func() {
		msg := <-sigs
		log.Info("Received signal", "signal", msg)
		s.shutdown()
	}()
}
