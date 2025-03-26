package ai

import (
	"github.com/hashicorp/go-retryablehttp"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"os"
	"strings"

	"github.com/pkg/errors"
)

// NewClient helper function to create a new OpenAI client from  a config
func NewClient(cfg config.Config) (*openai.Client, error) {
	// ************************************************************************
	// Setup middleware
	// ************************************************************************

	// Handle retryable errors
	// To handle retryable errors we use hashi corp's retryable client. This client will automatically retry on
	// retryable errors like 429; rate limiting
	retryClient := retryablehttp.NewClient()
	httpClient := retryClient.StandardClient()

	if cfg.OpenAI == nil {
		return nil, errors.New("OpenAI config is nil")
	}

	if cfg.OpenAI.APIKeyFile == "" {
		return nil, errors.New("OpenAI API key is empty")
	}

	b, err := os.ReadFile(cfg.OpenAI.APIKeyFile)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read OpenAI API key file: %s", cfg.OpenAI.APIKeyFile)
	}

	key := strings.TrimSpace(string(b))
	client := openai.NewClient(
		option.WithAPIKey(key), // defaults to os.LookupEnv("OPENAI_API_KEY")
		option.WithHTTPClient(httpClient),
	)
	return &client, nil
}
