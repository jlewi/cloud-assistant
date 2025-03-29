import { ReactNode, createContext, useContext, useState } from 'react'

import { create } from '@bufbuild/protobuf'

import {
  Block,
  BlockKind,
  BlockRole,
  BlockSchema,
  GenerateRequest,
  GenerateRequestSchema,
} from '../gen/es/cassie/blocks_pb'
import { useClient as useAgentClient } from './AgentContext'

type BlockContextType = {
  // Blocks is a map of all blocks from their ID to the actual proto
  blocks: Map<string, Block>

  setBlock: React.Dispatch<React.SetStateAction<Map<string, Block>>>

  // Block positions is map from BlockKind to the list of block IDs
  // for that Kind. These are arrayed in the order they should be displayed
  blockPositions: Map<BlockKind, string[]>
  setPositions: React.Dispatch<React.SetStateAction<Map<BlockKind, string[]>>>

  // Define additional functions to update the state
  // This way they can be set in the provider and passed down to the components
  updateBlock: (block: Block) => void

  sendUserBlock: (text: string) => Promise<void>
  // Keep track of whether the input is disabled
  isInputDisabled: boolean
}

const BlockContext = createContext<BlockContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useBlock = () => {
  const context = useContext(BlockContext)
  if (!context) {
    throw new Error('useBlock must be used within a BlockProvider')
  }
  return context
}

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const { client } = useAgentClient()
  const [blocks, setBlock] = useState<Map<string, Block>>(new Map())
  const [blockPositions, setPositions] = useState<Map<BlockKind, string[]>>(
    new Map()
  )

  const [isInputDisabled, setIsInputDisabled] = useState(false)

  const updateBlock = (block: Block) => {
    if (!blocks.has(block.id)) {
      console.log(`adding block: ${block.id}`)

      // Is it ok to do this or is this violating the fact that state should only
      // be mutated by React state functions
      blocks.set(block.id, block)

      // Since this is the first time we see this block add it to the end of the list of blocks
      setPositions((prevBlocksPos) => {
        if (!prevBlocksPos.has(block.kind)) {
          prevBlocksPos.set(block.kind, [])
        }
        let ids = prevBlocksPos.get(block.kind)
        if (!ids) {
          ids = []
        }
        ids = [...ids, block.id]
        prevBlocksPos.set(block.kind, ids)
        return prevBlocksPos
      })
    }
    setBlock((prevBlocks) => {
      console.log(`Setblocks called with ${prevBlocks.size} elements`)
      console.log(`Setblocks called to add ${block.id}`)
      const newBlocks = new Map(prevBlocks) // Create a new Map instance
      newBlocks.set(block.id, block) // Remove the block
      return newBlocks // Set the new state
    })
  }

  // sendUserBlock is a function that turns the text in the chat window into a block
  // which is then sent to the server
  const sendUserBlock = async (text: string) => {
    if (!text.trim()) return

    const userBlock = create(BlockSchema, {
      role: BlockRole.USER,
      kind: BlockKind.MARKUP,
      contents: text,
    })

    // Add the user block to the blocks map and positions
    updateBlock(userBlock)

    // TODO(jlewi): Sebastien had added an assistant block with "..." to indicate
    // the AI is thinking. This is a nice UX. How do we that properly?
    // Do we just do it on the frontend and remove the block as soon as we get a response from the backend?
    // Do we do it on the backend? So backend sends back a block with "..." and this block then gets updated
    // subsequently? I think I like that aproach
    // const assistantBlock = create(BlockSchema, {
    //   role: BlockRole.ASSISTANT,
    //   kind: BlockKind.MARKUP,
    //   contents: '...',
    // })

    //setBlocks((prevBlocks) => [...prevBlocks, userBlock, assistantBlock])
    setIsInputDisabled(true)

    const req: GenerateRequest = create(GenerateRequestSchema, {
      blocks: [userBlock],
    })

    try {
      const res = client!.generate(req)
      for await (const r of res) {
        for (const b of r.blocks) {
          updateBlock(b)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsInputDisabled(false)
    }
  }

  return (
    <BlockContext.Provider
      value={{
        blocks,
        blockPositions,
        setBlock,
        setPositions,
        updateBlock,
        sendUserBlock,
        isInputDisabled,
      }}
    >
      {children}
    </BlockContext.Provider>
  )
}

export { type Block, BlockRole, BlockKind }
