package ai

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/go-logr/logr"
	"github.com/go-logr/zapr"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/jlewi/cloud-assistant/app/pkg/application"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"go.uber.org/zap"
)

func TestAssertions(t *testing.T) {
	type asserter interface {
		Assert(ctx context.Context, assertion *cassie.Assertion, inputText string, blocks map[string]*cassie.Block) error
	}

	type testCase struct {
		name              string
		asserter          asserter
		assertion         *cassie.Assertion
		blocks            map[string]*cassie.Block
		expectedAssertion *cassie.Assertion
		inputText         string
	}

	testCases := []testCase{
		{
			name:     "kubectl-required-flags-present",
			asserter: shellRequiredFlag{},
			assertion: &cassie.Assertion{
				Name: "test-pass",
				Type: cassie.Assertion_TYPE_SHELL_REQUIRED_FLAG,
				Payload: &cassie.Assertion_ShellRequiredFlag_{
					ShellRequiredFlag: &cassie.Assertion_ShellRequiredFlag{
						Command: "kubectl",
						Flags:   []string{"--context", "-n"},
					},
				},
			},
			blocks: map[string]*cassie.Block{
				"1": {
					Kind:     cassie.BlockKind_CODE,
					Contents: "kubectl get pods --context test -n default",
				},
			},
			expectedAssertion: &cassie.Assertion{
				Name: "test-pass",
				Type: cassie.Assertion_TYPE_SHELL_REQUIRED_FLAG,
				Payload: &cassie.Assertion_ShellRequiredFlag_{
					ShellRequiredFlag: &cassie.Assertion_ShellRequiredFlag{
						Command: "kubectl",
						Flags:   []string{"--context", "-n"},
					},
				},
				Result: cassie.Assertion_RESULT_TRUE,
			},
		},
		{
			name:     "kubectl-required-flag-missing",
			asserter: shellRequiredFlag{},
			assertion: &cassie.Assertion{
				Name: "test-fail",
				Type: cassie.Assertion_TYPE_SHELL_REQUIRED_FLAG,
				Payload: &cassie.Assertion_ShellRequiredFlag_{
					ShellRequiredFlag: &cassie.Assertion_ShellRequiredFlag{
						Command: "kubectl",
						Flags:   []string{"--context", "-n"},
					},
				},
			},
			blocks: map[string]*cassie.Block{
				"1": {
					Kind:     cassie.BlockKind_CODE,
					Contents: "kubectl get pods --context test",
				},
			},
			expectedAssertion: &cassie.Assertion{
				Name: "test-fail",
				Type: cassie.Assertion_TYPE_SHELL_REQUIRED_FLAG,
				Payload: &cassie.Assertion_ShellRequiredFlag_{
					ShellRequiredFlag: &cassie.Assertion_ShellRequiredFlag{
						Command: "kubectl",
						Flags:   []string{"--context", "-n"},
					},
				},
				Result: cassie.Assertion_RESULT_FALSE,
			},
		},
		{
			name:     "file-search-file-found",
			asserter: fileRetrieved{},
			assertion: &cassie.Assertion{
				Name: "file-found",
				Type: cassie.Assertion_TYPE_FILE_RETRIEVED,
				Payload: &cassie.Assertion_FileRetrieval_{
					FileRetrieval: &cassie.Assertion_FileRetrieval{
						FileId:   "file-123",
						FileName: "test.txt",
					},
				},
			},
			blocks: map[string]*cassie.Block{
				"block1": {
					Kind: cassie.BlockKind_FILE_SEARCH_RESULTS,
					FileSearchResults: []*cassie.FileSearchResult{
						{FileID: "file-123", FileName: "test.txt"},
					},
				},
			},
			expectedAssertion: &cassie.Assertion{
				Name: "file-found",
				Type: cassie.Assertion_TYPE_FILE_RETRIEVED,
				Payload: &cassie.Assertion_FileRetrieval_{
					FileRetrieval: &cassie.Assertion_FileRetrieval{
						FileId:   "file-123",
						FileName: "test.txt",
					},
				},
				Result: cassie.Assertion_RESULT_TRUE,
			},
		},
		{
			name:     "file-search-file-not-found",
			asserter: fileRetrieved{},
			assertion: &cassie.Assertion{
				Name: "file-not-found",
				Type: cassie.Assertion_TYPE_FILE_RETRIEVED,
				Payload: &cassie.Assertion_FileRetrieval_{
					FileRetrieval: &cassie.Assertion_FileRetrieval{
						FileId:   "file-999",
						FileName: "notfound.txt",
					},
				},
			},
			blocks: map[string]*cassie.Block{
				"block1": {
					Kind: cassie.BlockKind_FILE_SEARCH_RESULTS,
					FileSearchResults: []*cassie.FileSearchResult{
						{FileID: "file-123", FileName: "test.txt"},
					},
				},
			},
			expectedAssertion: &cassie.Assertion{
				Name: "file-not-found",
				Type: cassie.Assertion_TYPE_FILE_RETRIEVED,
				Payload: &cassie.Assertion_FileRetrieval_{
					FileRetrieval: &cassie.Assertion_FileRetrieval{
						FileId:   "file-999",
						FileName: "notfound.txt",
					},
				},
				Result: cassie.Assertion_RESULT_FALSE,
			},
		},
		{
			name:     "tool-invocation-shell-command",
			asserter: toolInvocation{},
			assertion: &cassie.Assertion{
				Name: "shell-invoked",
				Type: cassie.Assertion_TYPE_TOOL_INVOKED,
				Payload: &cassie.Assertion_ToolInvocation_{
					ToolInvocation: &cassie.Assertion_ToolInvocation{
						ToolName: "shell",
					},
				},
			},
			blocks: map[string]*cassie.Block{
				"1": {
					Kind:     cassie.BlockKind_CODE,
					Contents: "echo hello world",
				},
			},
			expectedAssertion: &cassie.Assertion{
				Name: "shell-invoked",
				Type: cassie.Assertion_TYPE_TOOL_INVOKED,
				Payload: &cassie.Assertion_ToolInvocation_{
					ToolInvocation: &cassie.Assertion_ToolInvocation{
						ToolName: "shell",
					},
				},
				Result: cassie.Assertion_RESULT_TRUE,
			},
		},
		{
			name:     "tool-invocation-no-shell-command",
			asserter: toolInvocation{},
			assertion: &cassie.Assertion{
				Name: "shell-not-invoked",
				Type: cassie.Assertion_TYPE_TOOL_INVOKED,
				Payload: &cassie.Assertion_ToolInvocation_{
					ToolInvocation: &cassie.Assertion_ToolInvocation{
						ToolName: "shell",
					},
				},
			},
			blocks: map[string]*cassie.Block{
				"1": {
					Kind:     cassie.BlockKind_MARKUP,
					Contents: "This is not a code block.",
				},
			},
			expectedAssertion: &cassie.Assertion{
				Name: "shell-not-invoked",
				Type: cassie.Assertion_TYPE_TOOL_INVOKED,
				Payload: &cassie.Assertion_ToolInvocation_{
					ToolInvocation: &cassie.Assertion_ToolInvocation{
						ToolName: "shell",
					},
				},
				Result: cassie.Assertion_RESULT_FALSE,
			},
		},
		{
			name:     "llm-judge-basic",
			asserter: llmJudge{},
			assertion: &cassie.Assertion{
				Name: "basic_llm_judge",
				Type: cassie.Assertion_TYPE_LLM_JUDGE,
				Payload: &cassie.Assertion_LlmJudge{
					LlmJudge: &cassie.Assertion_LLMJudge{
						Prompt: "Do you think the LLM's command is mostly correct?",
					},
				},
			},
			blocks: map[string]*cassie.Block{
				"1": {
					Kind:     cassie.BlockKind_CODE,
					Contents: "az aks list --query \"[?name=='unified-60'].{Name:name, Location:location}\" --output table",
				},
			},
			expectedAssertion: &cassie.Assertion{
				Name: "basic_llm_juge",
				Type: cassie.Assertion_TYPE_LLM_JUDGE,
				Payload: &cassie.Assertion_LlmJudge{
					LlmJudge: &cassie.Assertion_LLMJudge{
						Prompt: "Do you think the LLM's command is mostly correct?",
					},
				},
				Result: cassie.Assertion_RESULT_TRUE,
			},
			inputText: "What region is cluster unified-60 in?",
		},
	}
	isGHA := os.Getenv("GITHUB_ACTIONS") == "true"
	app := application.NewApp()
	if err := app.LoadConfig(nil); err != nil {
		t.Fatal(err)
	}
	cfg := app.GetConfig()
	var apiKey string
	if !isGHA {
		// When running locally create the OpenAI client using the config
		apiKeyFile := cfg.OpenAI.APIKeyFile
		apiKeyBytes, err := os.ReadFile(apiKeyFile)
		if err != nil {
			t.Fatalf("Failed to read API key file; %v", err)
		}
		apiKey = string(apiKeyBytes)
	} else {
		// In GHA we get the API key from the environment variable
		apiKey = os.Getenv("OPENAI_API_KEY")
		if apiKey == "" {
			t.Fatal("OPENAI_API_KEY environment variable is not set")
		}
	}
	apiKey = strings.TrimSpace(apiKey)
	log := zapr.NewLogger(zap.L())
	ctx := logr.NewContext(context.Background(), log)
	ctx = ContextWithAPIKey(ctx, apiKey)
	opts := cmpopts.IgnoreUnexported(
		cassie.Assertion{},
		cassie.Assertion_ShellRequiredFlag{},
		cassie.Assertion_ToolInvocation{},
		cassie.Assertion_FileRetrieval{},
		cassie.Assertion_CodeblockRegex{},
		cassie.Assertion_LLMJudge{})

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.asserter.Assert(ctx, tc.assertion, tc.inputText, tc.blocks)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if d := cmp.Diff(tc.expectedAssertion, tc.assertion, opts); d != "" {
				t.Fatalf("unexpected diff in assertion (-want +got):\n%s", d)
			}
		})
	}
}
