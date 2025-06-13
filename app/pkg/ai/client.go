package ai

import (
	"os"
	"strings"

	"github.com/hashicorp/go-retryablehttp"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"

	"github.com/pkg/errors"
)

// NewClient helper function to create a new OpenAI client from  a config
func NewClient(cfg config.OpenAIConfig) (*openai.Client, error) {
	if cfg.APIKeyFile == "" {
		if cfg.Organization == "" || cfg.Project == "" {
			return nil, errors.New("IF APIKeyFile is not set, then Organization and Project must be set in Config.OpenAI to configure OAuth")
		}
	} else {
		if cfg.Organization != "" || cfg.Project != "" {
			return nil, errors.New("IF APIKeyFile is set, then Organization and Project must NOT be set in Config.OpenAI to disable OAuth")
		}
	}

	b, err := os.ReadFile(cfg.APIKeyFile)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read OpenAI API key file: %s", cfg.APIKeyFile)
	}

	key := strings.TrimSpace(string(b))

	return NewClientWithKey(key)
}

func NewClientWithKey(key string) (*openai.Client, error) {
	// ************************************************************************
	// Setup middleware
	// ************************************************************************

	// Handle retryable errors
	// To handle retryable errors we use hashi corp's retryable client. This client will automatically retry on
	// retryable errors like 429; rate limiting
	retryClient := retryablehttp.NewClient()
	httpClient := retryClient.StandardClient()

	client := openai.NewClient(
		option.WithAPIKey(key), // defaults to os.LookupEnv("OPENAI_API_KEY")
		option.WithHTTPClient(httpClient),
	)
	return &client, nil
}
