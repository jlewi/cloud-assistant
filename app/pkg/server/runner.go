package server

import (
	"github.com/pkg/errors"
	runnerv2 "github.com/runmedev/runme/v3/pkg/api/gen/proto/go/runme/runner/v2"
	"github.com/runmedev/runme/v3/pkg/command"
	"github.com/runmedev/runme/v3/pkg/runnerv2service"
	"go.uber.org/zap"
)

// Runner lets you run commands using Runme.
type Runner struct {
	server runnerv2.RunnerServiceServer
}

func NewRunner(logger *zap.Logger) (*Runner, error) {
	factory := command.NewFactory(command.WithLogger(logger))
	server, err := runnerv2service.NewRunnerService(factory, logger)

	if err != nil {
		return nil, errors.Wrapf(err, "Failed to create Runme runner service")
	}
	return &Runner{
		server: server,
	}, nil
}
