package docs

import (
  "github.com/jlewi/cloud-assistant/app/pkg/runme/converters"
  "github.com/jlewi/cloud-assistant/protos/gen/cassie"
  parserv1 "github.com/stateful/runme/v3/pkg/api/gen/proto/go/runme/parser/v1"
  "github.com/stateful/runme/v3/pkg/document/editor"
  "github.com/stateful/runme/v3/pkg/document/identity"
)

const (
  OUTPUTLANG = "output"
)

// MarkdownToBlocks converts a markdown string into a sequence of blocks.
// This function relies on RunMe's Markdown->Cells conversion; underneath the hood that uses goldmark to walk the AST.
// RunMe's deserialization function doesn't have any notion of output in markdown. However, in Foyle outputs
// are rendered to code blocks of language "output". So we need to do some post processing to convert the outputs
// into output items
func MarkdownToBlocks(mdText string) ([]*cassie.Block, error) {
  // N.B. We don't need to add any identities
  resolver := identity.NewResolver(identity.UnspecifiedLifecycleIdentity)
  options := editor.Options{
    IdentityResolver: resolver,
  }
  notebook, err := editor.Deserialize([]byte(mdText), options)

  blocks := make([]*cassie.Block, 0, len(notebook.Cells))

  var lastCodeBlock *cassie.Block
  for _, cell := range notebook.Cells {

    var tr *parserv1.TextRange

    if cell.TextRange != nil {
      tr = &parserv1.TextRange{
        Start: uint32(cell.TextRange.Start),
        End:   uint32(cell.TextRange.End),
      }
    }

    cellPb := &parserv1.Cell{
      Kind:       parserv1.CellKind(cell.Kind),
      Value:      cell.Value,
      LanguageId: cell.LanguageID,
      Metadata:   cell.Metadata,
      TextRange:  tr,
    }

    block, err := converters.CellToBlock(cellPb)
    if err != nil {
      return nil, err
    }

    // We need to handle the case where the block is an output code block.
    if block.Kind == cassie.BlockKind_CODE {
      if block.Language == OUTPUTLANG {
        // This is an output block
        // We need to append the output to the last code block
        if lastCodeBlock != nil {
          if lastCodeBlock.Outputs == nil {
            lastCodeBlock.Outputs = make([]*cassie.BlockOutput, 0, 1)
          }
          lastCodeBlock.Outputs = append(lastCodeBlock.Outputs, &cassie.BlockOutput{
            Items: []*cassie.BlockOutputItem{
              {
                TextData: block.Contents,
              },
            },
          })
          continue
        }

        // Since we don't have a code block to add the output to just treat it as a code block
      } else {
        // Update the lastCodeBlock
        lastCodeBlock = block
      }
    } else {
      // If we have a non-nil markup block then we zero out lastCodeBlock so that a subsequent output block
      // wouldn't be added to the last code block.
      if block.GetContents() != "" {
        lastCodeBlock = nil
      }
    }

    blocks = append(blocks, block)
  }

  return blocks, err
}
