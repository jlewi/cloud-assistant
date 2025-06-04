package ai

import (
	"context"
	"testing"

	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
)

func TestShellRequiredFlag_Pass(t *testing.T) {
	asserter := shellRequiredFlag{}
	assertion := &cassie.Assertion{
		Name: "test-pass",
		Type: cassie.Assertion_TYPE_SHELL_REQUIRED_FLAG,
		Payload: &cassie.Assertion_ShellRequiredFlag_{
			ShellRequiredFlag: &cassie.Assertion_ShellRequiredFlag{
				Command: "kubectl",
				Flags:   []string{"--context", "-n"},
			},
		},
	}
	blocks := map[string]*cassie.Block{
		"1": {
			Kind:     cassie.BlockKind_CODE,
			Contents: "kubectl get pods --context test -n default",
		},
	}
	err := asserter.Assert(context.Background(), assertion, blocks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assertion.Result != cassie.Assertion_RESULT_TRUE {
		t.Errorf("expected PASSED, got %v", assertion.Result)
	}
}

func TestShellRequiredFlag_Fail(t *testing.T) {
	asserter := shellRequiredFlag{}
	assertion := &cassie.Assertion{
		Name: "test-fail",
		Type: cassie.Assertion_TYPE_SHELL_REQUIRED_FLAG,
		Payload: &cassie.Assertion_ShellRequiredFlag_{
			ShellRequiredFlag: &cassie.Assertion_ShellRequiredFlag{
				Command: "kubectl",
				Flags:   []string{"--context", "-n"},
			},
		},
	}
	blocks := map[string]*cassie.Block{
		"1": {
			Kind:     cassie.BlockKind_CODE,
			Contents: "kubectl get pods --context test",
		},
	}
	err := asserter.Assert(context.Background(), assertion, blocks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assertion.Result != cassie.Assertion_RESULT_FALSE {
		t.Errorf("expected FAILED, got %v", assertion.Result)
	}
}

func TestFileRetrieved_Found(t *testing.T) {
	asserter := fileRetrieved{}
	assertion := &cassie.Assertion{
		Name: "file-found",
		Type: cassie.Assertion_TYPE_FILE_RETRIEVED,
		Payload: &cassie.Assertion_FileRetrieval_{
			FileRetrieval: &cassie.Assertion_FileRetrieval{
				FileId:   "file-123",
				FileName: "test.txt",
			},
		},
	}
	blocks := map[string]*cassie.Block{
		"block1": {
			Kind: cassie.BlockKind_FILE_SEARCH_RESULTS,
			FileSearchResults: []*cassie.FileSearchResult{
				{FileID: "file-123", FileName: "test.txt"},
			},
		},
	}
	err := asserter.Assert(context.Background(), assertion, blocks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assertion.Result != cassie.Assertion_RESULT_TRUE {
		t.Errorf("expected RESULT_TRUE, got %v", assertion.Result)
	}
}

func TestFileRetrieved_NotFound(t *testing.T) {
	asserter := fileRetrieved{}
	assertion := &cassie.Assertion{
		Name: "file-not-found",
		Type: cassie.Assertion_TYPE_FILE_RETRIEVED,
		Payload: &cassie.Assertion_FileRetrieval_{
			FileRetrieval: &cassie.Assertion_FileRetrieval{
				FileId:   "file-999",
				FileName: "notfound.txt",
			},
		},
	}
	blocks := map[string]*cassie.Block{
		"block1": {
			Kind: cassie.BlockKind_FILE_SEARCH_RESULTS,
			FileSearchResults: []*cassie.FileSearchResult{
				{FileID: "file-123", FileName: "test.txt"},
			},
		},
	}
	err := asserter.Assert(context.Background(), assertion, blocks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assertion.Result != cassie.Assertion_RESULT_FALSE {
		t.Errorf("expected RESULT_FALSE, got %v", assertion.Result)
	}
}

func TestToolInvocation_ShellInvoked(t *testing.T) {
	asserter := toolInvocation{}
	assertion := &cassie.Assertion{
		Name: "shell-invoked",
		Type: cassie.Assertion_TYPE_TOOL_INVOKED,
		Payload: &cassie.Assertion_ToolInvocation_{
			ToolInvocation: &cassie.Assertion_ToolInvocation{
				ToolName: "shell",
			},
		},
	}
	blocks := map[string]*cassie.Block{
		"1": {
			Kind:     cassie.BlockKind_CODE,
			Contents: "echo hello world",
		},
	}
	err := asserter.Assert(context.Background(), assertion, blocks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assertion.Result != cassie.Assertion_RESULT_TRUE {
		t.Errorf("expected RESULT_TRUE, got %v", assertion.Result)
	}
}

func TestToolInvocation_ShellNotInvoked(t *testing.T) {
	asserter := toolInvocation{}
	assertion := &cassie.Assertion{
		Name: "shell-not-invoked",
		Type: cassie.Assertion_TYPE_TOOL_INVOKED,
		Payload: &cassie.Assertion_ToolInvocation_{
			ToolInvocation: &cassie.Assertion_ToolInvocation{
				ToolName: "shell",
			},
		},
	}
	blocks := map[string]*cassie.Block{
		"1": {
			Kind:     cassie.BlockKind_MARKUP,
			Contents: "This is not a code block.",
		},
	}
	err := asserter.Assert(context.Background(), assertion, blocks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assertion.Result != cassie.Assertion_RESULT_FALSE {
		t.Errorf("expected RESULT_FALSE, got %v", assertion.Result)
	}
}
