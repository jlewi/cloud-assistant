package ai

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/jlewi/cloud-assistant/protos/gen/cassie"
	"github.com/openai/openai-go/responses"
)

func NullOpSender(resp *cassie.GenerateResponse) error {
	return nil
}

func Test_ProcessEvent(t *testing.T) {
	// This unittest is intended to ensure we properly accumulate events
	type testCase struct {
		name string
		// Preexisting blocks
		blocks map[string]*cassie.Block
		// Event to process
		event responses.ResponseStreamEventUnion
		// Expected block after processing the event
		expectedBlock *cassie.Block
	}

	textDeltaEvent := responses.ResponseTextDeltaEvent{
		Delta:  "world",
		ItemID: "abcd",
	}

	textDeltaEventBytes, err := json.Marshal(textDeltaEvent)

	if err != nil {
		t.Fatalf("Failed to marshal textDeltaEvent: %+v", err)
	}

	textDeltaEventUnion := &responses.ResponseStreamEventUnion{}

	if err := textDeltaEventUnion.UnmarshalJSON(textDeltaEventBytes); err != nil {
		t.Fatalf("Failed to unmarshal textDeltaEvent: %+v", err)
	}

	testCases := []testCase{
		{
			name:   "TextDelta-no-block",
			blocks: map[string]*cassie.Block{},
			event:  *textDeltaEventUnion,
			expectedBlock: &cassie.Block{
				Id:       "abcd",
				Kind:     cassie.BlockKind_MARKUP,
				Role:     cassie.BlockRole_BLOCK_ROLE_ASSISTANT,
				Contents: "world",
			},
		},
		{
			name: "TextDelta-accumulate",
			blocks: map[string]*cassie.Block{
				"abcd": {
					Id:       "abcd",
					Kind:     cassie.BlockKind_MARKUP,
					Contents: "hello",
				},
			},
			event: *textDeltaEventUnion,
			expectedBlock: &cassie.Block{
				Id:       "abcd",
				Kind:     cassie.BlockKind_MARKUP,
				Contents: "helloworld",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			b := &BlocksBuilder{
				blocks: tc.blocks,
			}
			if err := b.ProcessEvent(context.TODO(), tc.event, NullOpSender); err != nil {
				t.Fatalf("Failed to process event: %+v", err)
			}
			actual, ok := b.blocks[tc.expectedBlock.Id]
			if !ok {
				t.Fatalf("Block %s not found", tc.expectedBlock.Id)
			}

			opts := cmpopts.IgnoreUnexported(cassie.Block{})
			if d := cmp.Diff(tc.expectedBlock, actual, opts); d != "" {
				t.Fatalf("Unexpected diff in block block:\n%s", d)
			}
		})
	}
}
