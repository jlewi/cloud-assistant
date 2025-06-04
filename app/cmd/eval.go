package cmd

import (
	"encoding/json"
	"os"

	"github.com/jlewi/cloud-assistant/app/pkg/ai"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/spf13/cobra"
	"google.golang.org/protobuf/encoding/protojson"
	"gopkg.in/yaml.v3"
)

func NewEvalCmd() *cobra.Command {
	cmd := cobra.Command{
		Use:   "eval <yaml-file>",
		Short: "Run evaluation using a single experiment YAML file",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			app := application.NewApp()
			if err := app.LoadConfig(cmd); err != nil {
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
			_, err = ai.EvalFromExperiment(&experiment)
			if err != nil {
				return err
			}

			return nil
		},
	}
	return &cmd
}
