package server

import (
	"connectrpc.com/grpchealth"
	"golang.org/x/net/http2"

	//"connectrpc.com/otelconnect"
	"context"
	"fmt"
	"github.com/go-logr/zapr"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/pkg/errors"
	//"github.com/stateful/runme/v3/pkg/api/gen/proto/go/runme/runner/v2/runnerv2connect"
	"go.uber.org/zap"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// Server is the main server for the cloud assistant
type Server struct {
	config           config.Config
	hServer          *http.Server
	engine           *http.ServeMux
	shutdownComplete chan bool
	runner           *Runner
}

// NewServer creates a new server
func NewServer(cfg config.Config) (*Server, error) {
	if cfg.OpenAI == nil {
		return nil, errors.New("OpenAI config is nil")
	}
	if cfg.OpenAI.APIKeyFile == "" {
		return nil, errors.New("OpenAI API key is empty")
	}

	var runner *Runner
	log := zapr.NewLogger(zap.L())
	if cfg.AssistantServer.RunnerService {
		var err error
		runner, err = NewRunner(zap.L())
		if err != nil {
			return nil, err
		}
	} else {
		log.Info("Runner service is disabled")
	}

	s := &Server{
		config: cfg,
		runner: runner,
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

	serverConfig := s.config.AssistantServer
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
		Handler:      s.engine,
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
	mux := http.NewServeMux()

	sHandler := &WebSocketHandler{
		runner: s.runner,
	}
	// Mount other Connect handlers
	mux.Handle("/ws", http.HandlerFunc(sHandler.Handler))

	checker := grpchealth.NewStaticChecker()
	mux.Handle(grpchealth.NewHandler(checker))

	s.engine = mux

	s.addStaticAssets()
	return nil
}

func (s *Server) addStaticAssets() {
	log := zapr.NewLogger(zap.L())
	staticAssets := s.config.AssistantServer.StaticAssets
	if staticAssets == "" {
		log.Info("No static assets to serve")
	}

	log.Info("Adding static assets", "dir", staticAssets)
	fileServer := http.FileServer(http.Dir(staticAssets))

	s.engine.Handle("/", fileServer)
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
