package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/go-logr/zapr"
	"github.com/jlewi/cloud-assistant/app/pkg/ai"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
	"google.golang.org/protobuf/encoding/protojson"
	"gopkg.in/yaml.v3"
)

func NewEvalCmd() *cobra.Command {
	var cookieFile string
	cmd := cobra.Command{
		Use:   "eval <yaml-file>",
		Short: "Run evaluation using a single experiment YAML file",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if cookieFile == "" {
				return fmt.Errorf("--cookie-file flag is required")
			}
			app := application.NewApp()
			if err := app.LoadConfig(cmd); err != nil {
				return err
			}
			if err := app.SetupServerLogging(); err != nil {
				return err
			}

			// Read the experiment YAML file
			data, err := os.ReadFile(args[0])
			if err != nil {
				return err
			}
			var m map[string]interface{}
			if err := yaml.Unmarshal(data, &m); err != nil {
				return err
			}
			jsonBytes, err := json.Marshal(m) // use json as intermediate format
			if err != nil {
				return err
			}
			var experiment cassie.Experiment
			if err := protojson.Unmarshal(jsonBytes, &experiment); err != nil {
				return err
			}

			// Read the cookie file (.env-style)
			cookieData, err := os.ReadFile(cookieFile)
			if err != nil {
				return fmt.Errorf("failed to read cookie file: %w", err)
			}
			cookies := make(map[string]string)
			lines := strings.Split(string(cookieData), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				if len(parts) == 2 {
					cookies[parts[0]] = parts[1]
				}
			}
			log := zapr.NewLogger(zap.L())
			_, err = ai.EvalFromExperiment(&experiment, cookies, log)
			if err != nil {
				return err
			}

			return nil
		},
	}
	cmd.Flags().StringVar(&cookieFile, "cookie-file", "", "Path to the cookie file (required)")
	if err := cmd.MarkFlagRequired("cookie-file"); err != nil {
		panic(err)
	}
	return &cmd
}
