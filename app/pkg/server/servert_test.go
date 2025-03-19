package server

import (
	"connectrpc.com/connect"
	"context"
	"fmt"
	"github.com/go-logr/zapr"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/monogo/networking"
	"github.com/pkg/errors"
	"go.uber.org/zap"
	"google.golang.org/grpc/health/grpc_health_v1"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"testing"
	"time"
)

func Test_ExecuteWithRunme(t *testing.T) {
	SkipIfMissing(t, "RUN_MANUAL_TESTS")

	app := application.NewApp()
	err := app.LoadConfig(nil)
	if err != nil {
		t.Fatalf("Error loading config; %v", err)
	}
	cfg := app.Config

	if err := app.SetupLogging(); err != nil {
		t.Fatalf("Error setting up logging; %v", err)
	}

	log := zapr.NewLoggerWithOptions(zap.L(), zapr.AllowZapFields(true))

	port, err := networking.GetFreePort()
	if err != nil {
		t.Fatalf("Error getting free port; %v", err)
	}

	if cfg.AssistantServer == nil {
		cfg.AssistantServer = &config.AssistantServerConfig{}
	}
	cfg.AssistantServer.Port = port
	// N.B. Server currently needs to be started manually. Should we start it autommatically?
	addr := fmt.Sprintf("http://localhost:%v", cfg.AssistantServer.Port)
	go func() {
		if err := setupAndRunServer(*cfg); err != nil {
			log.Error(err, "Error running server")
		}
	}()

	// N.B. There's probably a race condition here because the client might start before the server is fully up.
	// Or maybe that's implicitly handled because the connection won't succeed until the server is up?
	if err := waitForServer(addr); err != nil {
		t.Fatalf("Error waiting for server; %v", err)
	}

	log.Info("Server started")
	_, err = runRunmeClient(addr)

	if err != nil {
		t.Fatalf("Error running client for addres %v; %v", addr, err)
	}

}

func setupAndRunServer(cfg config.Config) error {
	log := zapr.NewLogger(zap.L())
	srv, err := NewServer(cfg)
	if err != nil {
		return errors.Wrap(err, "Failed to create server")
	}
	go func() {
		srv.Run()
		log.Info("Shutting down server...")
		srv.shutdown()
	}()
	log.Info("Server stopped")
	return nil
}

func waitForServer(addr string) error {
	log := zapr.NewLogger(zap.L())
	log.Info("Waiting for server to start", "address", addr)
	endTime := time.Now().Add(30 * time.Second)
	wait := 2 * time.Second
	for time.Now().Before(endTime) {

		client := connect.NewClient[grpc_health_v1.HealthCheckRequest, grpc_health_v1.HealthCheckResponse](
			http.DefaultClient,
			addr+"/grpc.health.v1.Health/Check", // Adjust if using a different route
			connect.WithGRPC(),
		)

		resp, err := client.CallUnary(context.Background(), connect.NewRequest(&grpc_health_v1.HealthCheckRequest{}))

		if err != nil {
			time.Sleep(wait)
			continue
		}

		if resp.Msg.GetStatus() == grpc_health_v1.HealthCheckResponse_SERVING {
			return nil
		} else {
			log.Info("Server not ready", "status", resp.Msg.GetStatus())
		}
	}
	return errors.Errorf("Server didn't start in time")
}

func runRunmeClient(baseURL string) (map[string]any, error) {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	log := logs.NewLogger()

	blocks := make(map[string]any)

	base, err := url.Parse(baseURL)
	if err != nil {
		log.Error(err, "Failed to parse URL")
		return blocks, errors.Wrapf(err, "Failed to parse URL")
	}

	u := url.URL{Scheme: "ws", Host: fmt.Sprintf("%s", base.Host), Path: "/ws"}
	log.Info("connecting to", "host", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		return blocks, errors.Wrapf(err, "Failed to dial; %v", err)
	}
	defer c.Close()

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Error(err, "read error")
				return
			}
			log.Info("received", "message", string(message))
		}
	}()

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return blocks, nil
		case t := <-ticker.C:
			message := fmt.Sprintf("Hello, the time is %v", t)
			err := c.WriteMessage(websocket.TextMessage, []byte(message))
			if err != nil {
				log.Error(err, "write error")
				return blocks, errors.Wrapf(err, "Failed to write message; %v", err)
			}
		case <-interrupt:
			log.Info("interrupt")

			// Cleanly close the connection by sending a close message and then
			// waiting (with timeout) for the server to close the connection.
			err := c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Error(err, "write close error")
				return blocks, errors.Wrapf(err, "Failed to write close message; %v", err)
			}
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return blocks, nil
		}
	}

	return blocks, nil
}

func SkipIfMissing(t *testing.T, env string) string {
	t.Helper()
	if value, ok := os.LookupEnv(env); ok {
		return value
	}
	t.Skipf("missing %s", env)
	return ""
}
