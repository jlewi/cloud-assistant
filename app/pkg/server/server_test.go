package server

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/go-logr/zapr"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jlewi/cloud-assistant/app/pkg/ai"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/jlewi/cloud-assistant/app/pkg/logs"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie/cassieconnect"
	"github.com/jlewi/monogo/networking"
	"github.com/pkg/errors"
	v2 "github.com/runmedev/runme/v3/pkg/api/gen/proto/go/runme/runner/v2"
	"go.uber.org/zap"
	"golang.org/x/net/http2"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/protobuf/encoding/protojson"
)

func Test_GenerateBlocks(t *testing.T) {
	SkipIfMissing(t, "RUN_MANUAL_TESTS")

	app := application.NewApp()
	err := app.LoadConfig(nil)
	if err != nil {
		t.Fatalf("Error loading config; %v", err)
	}
	cfg := app.GetConfig()

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
	blocks, err := runAIClient(addr)

	if err != nil {
		t.Fatalf("Error running client for addres %v; %v", addr, err)
	}

	if len(blocks) < 2 {
		t.Errorf("Expected at least 2 blocks; got %d blocks", len(blocks))
	}

	// Ensure there is a filesearch results block and that the filenames are set. This is intended
	// to catch various bugs with the SDK; e.g.
	// https://openai.slack.com/archives/C05C3578WQZ/p1741520938xxxxx5?thread_ts=1741090029.923169&cid=C05C3578WQZ
	hasFSBlock := false
	for _, b := range blocks {
		if b.Kind == cassie.BlockKind_FILE_SEARCH_RESULTS {
			hasFSBlock = true

			if len(b.FileSearchResults) <= 0 {
				t.Errorf("FileSearchResults block has no results")
			}

			for _, r := range b.FileSearchResults {
				if r.FileName == "" {
					t.Errorf("FileSearchResults block has empty filename")
				}
			}
		}
	}

	if !hasFSBlock {
		t.Errorf("There was no FileSearch block in the results.")
	}

}

func runAIClient(baseURL string) (map[string]*cassie.Block, error) {
	log := zapr.NewLoggerWithOptions(zap.L(), zapr.AllowZapFields(true))

	blocks := make(map[string]*cassie.Block)

	Block := cassie.Block{
		Kind:     cassie.BlockKind_MARKUP,
		Contents: "This is a block",
	}

	log.Info("Block", logs.ZapProto("block", &Block))

	u, err := url.Parse(baseURL)
	if err != nil {
		log.Error(err, "Failed to parse URL")
		return blocks, errors.Wrapf(err, "Failed to parse URL")
	}

	var client cassieconnect.BlocksServiceClient

	if u.Scheme == "https" {
		// Configure the TLS settings
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true, // Set to true only for testing; otherwise validate the server's certificate
		}

		client = cassieconnect.NewBlocksServiceClient(
			&http.Client{
				Transport: &http2.Transport{
					TLSClientConfig: tlsConfig,
					DialTLSContext: func(ctx context.Context, network, addr string, config *tls.Config) (net.Conn, error) {
						// Create a secure connection with TLS
						return tls.Dial(network, addr, config)
					},
				},
			},
			baseURL,
		)
	} else {
		client = cassieconnect.NewBlocksServiceClient(
			&http.Client{
				Transport: &http2.Transport{
					AllowHTTP: true,
					DialTLSContext: func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
						// Use the standard Dial function to create a plain TCP connection
						return net.Dial(network, u.Host)
					},
				},
			},
			baseURL,
		)
	}

	ctx := context.Background()
	genReq := &cassie.GenerateRequest{
		Blocks: []*cassie.Block{
			{
				Kind:     cassie.BlockKind_MARKUP,
				Role:     cassie.BlockRole_BLOCK_ROLE_USER,
				Contents: "Show me all the AKS clusters at OpenAI",
			},
		},
	}
	stream, err := client.Generate(ctx, connect.NewRequest(genReq))
	if err != nil {
		return blocks, errors.Wrapf(err, "Failed to create generate stream")
	}

	// Receive responses
	for stream.Receive() {
		response := stream.Msg()

		for _, block := range response.Blocks {
			blocks[block.Id] = block

			options := protojson.MarshalOptions{
				Multiline: true,
				Indent:    "  ", // Two spaces for indentation
			}

			// Marshal the protobuf message to JSON
			jsonData, err := options.Marshal(block)
			if err != nil {
				log.Error(err, "Failed to marshal block to JSON")
			} else {
				log.Info("Block", "block", string(jsonData))
			}
		}

	}

	if stream.Err() != nil {
		return blocks, errors.Wrapf(stream.Err(), "Error receiving response")
	}
	return blocks, nil
}

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

func Test_ExecuteWithRunmeConcurrent(t *testing.T) {
	// The purpose of this test test is to verify that if we use to ExecuteRequests without waiting for the first to
	// finish that the server can handle this. Specifically, we want to make sure we don't have concurrent writes
	// to the websocket on the backend because that causes a panic
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
	_, err = runRunmeClientConcurrent(addr)

	if err != nil {
		t.Fatalf("Error running client for addres %v; %v", addr, err)
	}

}

func setupAndRunServer(cfg config.Config) error {
	log := zapr.NewLogger(zap.L())

	client, err := ai.NewClient(*cfg.OpenAI)

	if err != nil {
		return errors.Wrap(err, "Failed to create client")
	}

	agentOptions := &ai.AgentOptions{}

	if err := agentOptions.FromAssistantConfig(*cfg.CloudAssistant); err != nil {
		return err
	}

	agentOptions.Client = client

	agent, err := ai.NewAgent(*agentOptions)

	if err != nil {
		return err
	}

	serverOptions := &Options{
		Telemetry: cfg.Telemetry,
		Server:    cfg.AssistantServer,
	}
	srv, err := NewServer(*serverOptions, agent)

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

func runRunmeClientConcurrent(baseURL string) (map[string]any, error) {
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

	req := newExecuteRequest([]string{`
for i in {1..10}
do
  echo "hello world - from 1"
  sleep 1
done`})

	// Send one command
	if err := sendExecuteRequest(c, req); err != nil {
		return blocks, errors.Wrapf(err, "Failed to send execute request; %v", err)
	}

	req2 := newExecuteRequest([]string{`
for i in {1..10}
do
  echo "hello world - from 2"
  sleep 1
done`})

	// Send second command
	if err := sendExecuteRequest(c, req2); err != nil {
		return blocks, errors.Wrapf(err, "Failed to send execute request; %v", err)
	}

	// Wait for the command to finish.
	block, err := waitForCommandToFinish(c)
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
