import { ReactNode, createContext, useContext, useMemo, useState } from 'react'

import { create } from '@bufbuild/protobuf'
import { v4 as uuidv4 } from 'uuid'

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
  // useColumns returns arrays of blocks organized by their kind
  useColumns: () => {
    chat: Block[]
    actions: Block[]
    files: Block[]
  }

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

interface BlockState {
  blocks: Record<string, Block>
  positions: Record<string, string[]>
}

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const [isInputDisabled, setIsInputDisabled] = useState(false)

  const { client } = useAgentClient()
  const [state, setState] = useState<BlockState>({
    blocks: {},
    positions: {
      [BlockKind.UNKNOWN_BLOCK_KIND]: [],
      [BlockKind.MARKUP]: [],
      [BlockKind.CODE]: [],
      [BlockKind.FILE_SEARCH_RESULTS]: [],
    },
  })

  const chatBlocks = useMemo(() => {
    return state.positions[BlockKind.MARKUP]
      .map((id) => state.blocks[id])
      .filter(Boolean)
  }, [state.blocks, state.positions])

  const actionBlocks = useMemo(() => {
    return state.positions[BlockKind.CODE]
      .map((id) => state.blocks[id])
      .filter(Boolean)
  }, [state.blocks, state.positions])

  const fileBlocks = useMemo(() => {
    return state.positions[BlockKind.FILE_SEARCH_RESULTS]
      .map((id) => state.blocks[id])
      .filter(Boolean)
  }, [state.blocks, state.positions])

  const useColumns = () => {
    return {
      chat: chatBlocks,
      actions: actionBlocks,
      files: fileBlocks,
    }
  }

  const updateBlock = (block: Block) => {
    setState((prev) => {
      if (!prev.blocks[block.id]) {
        return {
          blocks: {
            ...prev.blocks,
            [block.id]: block,
          },
          positions: {
            ...prev.positions,
            [block.kind]: [...(prev.positions[block.kind] || []), block.id],
          },
        }
      }

      return {
        ...prev,
        blocks: {
          ...prev.blocks,
          [block.id]: block,
        },
      }
    })
  }

  // sendUserBlock is a function that turns the text in the chat window into a block
  // which is then sent to the server
  const sendUserBlock = async (text: string) => {
    if (!text.trim()) return

    const userBlock = create(BlockSchema, {
      id: `user_${uuidv4()}`,
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
        useColumns,
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
