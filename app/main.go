package main

import (
	"fmt"
	"os"

	agentCmd "github.com/runmedev/runme/v3/pkg/agent/cmd"
)

func main() {
	rootCmd := agentCmd.NewAgentCmd("cloud-assistant")

	if err := rootCmd.Execute(); err != nil {
		fmt.Printf("Command failed with error: %+v", err)
		os.Exit(1)
	}
}
