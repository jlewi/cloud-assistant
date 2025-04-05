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

      if err := app.SetupServerLogging(); err != nil {
        return err
      }

      agentOptions := &ai.AgentOptions{}

      if err := agentOptions.FromAssistantConfig(*app.Config.CloudAssistant); err != nil {
        return err
      }

      client, err := ai.NewClient(*app.Config.OpenAI)
      if err != nil {
        return err
      }

      agentOptions.Client = client

      agent, err := ai.NewAgent(*agentOptions)
      if err != nil {
        return err
      }

      serverOptions := &server.Options{
        Telemetry: app.Config.Telemetry,
        Server:    app.Config.AssistantServer,
      }
      s, err := server.NewServer(*serverOptions, agent)
      if err != nil {
        return err
      }

      return s.Run()
    },
  }

  return &cmd
}
