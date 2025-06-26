package cmd

import (
	"fmt"
	"os"

	"github.com/runmedev/runme/v3/pkg/agent/cmd"
	"github.com/runmedev/runme/v3/pkg/agent/config"
	"github.com/spf13/cobra"
)

func NewRootCmd() *cobra.Command {
	var cfgFile string
	var level string
	var jsonLog bool
	rootCmd := &cobra.Command{
		Short: config.AppName,
	}

	rootCmd.PersistentFlags().StringVar(&cfgFile, config.ConfigFlagName, "", fmt.Sprintf("config file (default is $HOME/.%s/config.yaml)", config.AppName))
	rootCmd.PersistentFlags().StringVarP(&level, config.LevelFlagName, "", "info", "The logging level.")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-logs", "", false, "Enable json logging.")

	rootCmd.AddCommand(cmd.NewVersionCmd(os.Stdout))
	rootCmd.AddCommand(cmd.NewConfigCmd())
	rootCmd.AddCommand(cmd.NewRunCmd())
	rootCmd.AddCommand(cmd.NewServeCmd())
	rootCmd.AddCommand(cmd.NewEnvCmd())
	rootCmd.AddCommand(cmd.NewEvalCmd())

	return rootCmd
}
