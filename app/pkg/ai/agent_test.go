package ai

import (
  "context"
  "github.com/google/go-cmp/cmp"
  "github.com/jlewi/cloud-assistant/protos/gen/cassie"
  "google.golang.org/protobuf/testing/protocmp"
  "testing"

  "github.com/hashicorp/golang-lru/v2"
)

// Define a mock Block struct if it's not available
// This is just a placeholder. Replace with the correct implementation.
type Block struct {
  Id string
}

func TestFillInToolcalls(t *testing.T) {

  // Define test cases
  tests := []struct {
    name               string
    previousResponseId string
    cachedResponses    map[string][]string
    cachedBlocks       map[string]*cassie.Block
    request            *cassie.GenerateRequest
    expected           *cassie.GenerateRequest
  }{
    {
      name:               "Missing Previous Calls",
      previousResponseId: "abc",
      cachedResponses: map[string][]string{
        "abc": {"block1"},
      },
      cachedBlocks: map[string]*cassie.Block{
        "block1": {
          Id:       "block1",
          Kind:     cassie.BlockKind_CODE,
          Contents: "print('Hello, world!')",
          CallId:   "call1",
        },
      },
      request: &cassie.GenerateRequest{
        PreviousResponseId: "abc",
      },
      expected: &cassie.GenerateRequest{
        PreviousResponseId: "abc",
        Blocks: []*cassie.Block{
          {
            Id:       "block1",
            Kind:     cassie.BlockKind_CODE,
            Contents: "print('Hello, world!')",
            CallId:   "call1",
          },
        },
      },
    },
    {
      name:               "Has Previous Calls",
      previousResponseId: "abc",
      cachedResponses: map[string][]string{
        "abc": {"block1"},
      },
      cachedBlocks: map[string]*cassie.Block{
        "block1": {
          Id:       "block1",
          Kind:     cassie.BlockKind_CODE,
          Contents: "print('This was the original command!')",
          CallId:   "call1",
        },
      },
      request: &cassie.GenerateRequest{
        PreviousResponseId: "abc",
        Blocks: []*cassie.Block{
          // We want to ensure that the block in the request takes precendence over the cache
          {
            Id:       "block1",
            Kind:     cassie.BlockKind_CODE,
            Contents: "print('Actual Command')",
            CallId:   "call1",
          },
        },
      },
      expected: &cassie.GenerateRequest{
        PreviousResponseId: "abc",
        Blocks: []*cassie.Block{
          {
            Id:       "block1",
            Kind:     cassie.BlockKind_CODE,
            Contents: "print('Actual Command')",
            CallId:   "call1",
          },
        },
      },
    },
  }

  // Run each test case
  for _, tc := range tests {
    t.Run(tc.name, func(t *testing.T) {
      // Initialize cache with a size large enough for the test
      responseCache, err := lru.New[string, []string](5)
      if err != nil {
        t.Fatalf("Failed to create response cache: %v", err)
      }

      blocksCache, err := lru.New[string, *cassie.Block](5)
      if err != nil {
        t.Fatalf("Failed to create blocks cache: %v", err)
      }

      // Populate response cache
      for respID, calls := range tc.cachedResponses {
        responseCache.Add(respID, calls)
      }

      // Populate blocks cache
      for blockID, block := range tc.cachedBlocks {
        blocksCache.Add(blockID, block)
      }

      if err := fillInToolcalls(context.Background(), responseCache, blocksCache, tc.request); err != nil {
        t.Fatalf("Failed to fill in tool calls: %v", err)
      }

      // Check if the request matches the expected result
      if d := cmp.Diff(tc.expected, tc.request, protocmp.Transform()); d != "" {
        t.Errorf("Request mismatch (-want +got):\n%s", d)
      }
    })
  }
}
