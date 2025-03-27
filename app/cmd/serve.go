package cmd

import (
	"github.com/jlewi/cloud-assistant/app/pkg/ai"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/app/pkg/server"
	"github.com/spf13/cobra"
)

func NewServeCmd() *cobra.Command {
	cmd := cobra.Command{
		Use:   "serve",
		Short: "Start the Assistant and Runme server",
		RunE: func(cmd *cobra.Command, args []string) error {
			app := application.NewApp()

			// Load the configuration
			if err := app.LoadConfig(cmd); err != nil {
				return err
			}

			if err := app.SetupLogging(); err != nil {
				return err
			}

			client, err := ai.NewClient(*app.Config)
			if err != nil {
				return err
			}

			agent, err := ai.NewAgent(app.Config.CloudAssistant, client)
			if err != nil {
				return err
			}
			s, err := server.NewServer(*app.Config, agent)
			if err != nil {
				return err
			}

			return s.Run()
		},
	}

	return &cmd
}
