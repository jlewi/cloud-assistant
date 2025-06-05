package ai

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
)

func TestAssertions(t *testing.T) {
	type asserter interface {
		Assert(ctx context.Context, assertion *cassie.Assertion, blocks map[string]*cassie.Block) error
	}

	type testCase struct {
		name           string
		asserter       asserter
		assertion      *cassie.Assertion
		blocks         map[string]*cassie.Block
		expectedResult cassie.Assertion_Result
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
			expectedResult: cassie.Assertion_RESULT_TRUE,
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
			expectedResult: cassie.Assertion_RESULT_FALSE,
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
			expectedResult: cassie.Assertion_RESULT_TRUE,
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
			expectedResult: cassie.Assertion_RESULT_FALSE,
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
			expectedResult: cassie.Assertion_RESULT_TRUE,
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
			expectedResult: cassie.Assertion_RESULT_FALSE,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.asserter.Assert(context.TODO(), tc.assertion, tc.blocks)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if d := cmp.Diff(tc.expectedResult, tc.assertion.Result); d != "" {
				t.Fatalf("unexpected diff in assertion result (-want +got):\n%s", d)
			}
		})
	}
}
