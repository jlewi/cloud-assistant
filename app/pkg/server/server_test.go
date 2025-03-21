package server

import (
	"connectrpc.com/connect"
	"context"
	"fmt"
	"github.com/go-logr/zapr"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/jlewi/monogo/networking"
	"github.com/pkg/errors"
	v2 "github.com/stateful/runme/v3/pkg/api/gen/proto/go/runme/runner/v2"
	"go.uber.org/zap"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/protobuf/encoding/protojson"
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
		if err := srv.Run(); err != nil {
			log.Error(err, "Error running server")
		}
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

	u := url.URL{Scheme: "ws", Host: base.Host, Path: "/ws"}
	log.Info("connecting to", "host", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		return blocks, errors.Wrapf(err, "Failed to dial; %v", err)
	}
	defer c.Close()

	// Send one command
	if err := sendExecuteRequest(c, newExecuteRequest([]string{"ls -la"})); err != nil {
		return blocks, errors.Wrapf(err, "Failed to send execute request; %v", err)
	}

	// Wait for the command to finish.
	block, err := waitForCommandToFinish(c)
	if err != nil {
		return blocks, errors.Wrapf(err, "Failed to wait for command to finish; %v", err)
	}

	log.Info("Block", "block", logs.ZapProto("block", block))

	// Send second command
	if err := sendExecuteRequest(c, newExecuteRequest([]string{"echo The date is $(DATE)"})); err != nil {
		return blocks, errors.Wrapf(err, "Failed to send execute request; %v", err)
	}

	// Wait for the command to finish.
	block, err = waitForCommandToFinish(c)
	if err != nil {
		return blocks, errors.Wrapf(err, "Failed to wait for command to finish; %v", err)
	}

	log.Info("Block", "block", logs.ZapProto("block", block))

	return blocks, nil
}

// newExecuteRequest is a helper function to create an ExecuteRequest.
func newExecuteRequest(commands []string) *v2.ExecuteRequest {
	executeRequest := &v2.ExecuteRequest{
		Config: &v2.ProgramConfig{
			ProgramName:   "/bin/zsh",
			Arguments:     make([]string, 0),
			LanguageId:    "sh",
			Background:    false,
			FileExtension: "",
			Env: []string{
				`RUNME_ID=${blockID}`,
				"RUNME_RUNNER=v2",
				"TERM=xterm-256color",
			},
			Source: &v2.ProgramConfig_Commands{
				Commands: &v2.ProgramConfig_CommandList{
					Items: commands,
				},
			},
			Interactive: true,
			Mode:        v2.CommandMode_COMMAND_MODE_INLINE,
			KnownId:     uuid.NewString(),
		},
		Winsize: &v2.Winsize{Rows: 34, Cols: 100, X: 0, Y: 0},
	}
	return executeRequest
}

// sendExecuteRequest sends an ExecuteRequest to the server.
func sendExecuteRequest(c *websocket.Conn, executeRequest *v2.ExecuteRequest) error {
	socketRequest := &cassie.SocketRequest{
		Payload: &cassie.SocketRequest_ExecuteRequest{
			ExecuteRequest: executeRequest,
		},
	}

	message, err := protojson.Marshal(socketRequest)
	if err != nil {
		return errors.Wrapf(err, "Failed to marshal message; %v", err)
	}

	err = c.WriteMessage(websocket.TextMessage, []byte(message))
	if err != nil {
		return errors.Wrapf(err, "Failed to write message; %v", err)
	}
	return nil
}

func waitForCommandToFinish(c *websocket.Conn) (*cassie.Block, error) {
	log := logs.NewLogger()

	block := &cassie.Block{
		Outputs: make([]*cassie.BlockOutput, 0),
	}

	block.Outputs = append(block.Outputs, &cassie.BlockOutput{

		Items: []*cassie.BlockOutputItem{
			{
				TextData: "",
			},
			{
				TextData: "",
			},
		},
	})
	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Error(err, "read error")
		}

		response := &cassie.SocketResponse{}
		if err := protojson.Unmarshal(message, response); err != nil {
			log.Error(err, "Failed to unmarshal message")
			return block, errors.Wrapf(err, "Failed to unmarshal message; %v", err)
		}
		if response.GetExecuteResponse() != nil {
			resp := response.GetExecuteResponse()

			block.Outputs[0].Items[0].TextData += string(resp.StdoutData)
			block.Outputs[0].Items[1].TextData += string(resp.StderrData)

			if resp.GetExitCode() != nil {
				// Use ExitCode to determine if the message indicates the end of the program
				return block, nil
			}
			log.Info("Command Response", "stdout", string(resp.StdoutData), "stderr", string(resp.StderrData), "exitCode", resp.ExitCode)
		} else {
			log.Info("received", "message", string(message))
		}
	}

}

func SkipIfMissing(t *testing.T, env string) string {
	t.Helper()
	if value, ok := os.LookupEnv(env); ok {
		return value
	}
	t.Skipf("missing %s", env)
	return ""
}
