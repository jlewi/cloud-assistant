import { ReactNode, createContext, useContext, useMemo, useState } from 'react'

import { clone, create } from '@bufbuild/protobuf'
import { v4 as uuidv4 } from 'uuid'

import {
  Block,
  BlockKind,
  BlockOutputItemSchema,
  BlockOutputKind,
  BlockOutputSchema,
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
  sendOutputBlock: (outputBlock: Block) => Promise<void>
  createOutputBlock: (inputBlock: Block) => Block
  sendUserBlock: (text: string) => Promise<void>
  addCodeBlock: () => void
  // Keep track of whether the input is disabled
  isInputDisabled: boolean
  isTyping: boolean
  // Function to run a code block
  runCodeBlock: (block: Block) => void
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
  positions: string[]
}

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const [isInputDisabled, setIsInputDisabled] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [previousResponseId, setPreviousResponseId] = useState<
    string | undefined
  >()

  const { client } = useAgentClient()
  const [state, setState] = useState<BlockState>({
    blocks: {},
    positions: [],
  })

  const chatBlocks = useMemo(() => {
    return state.positions
      .map((id) => state.blocks[id])
      .filter(
        (block): block is Block =>
          Boolean(block) &&
          (block.kind === BlockKind.MARKUP || block.kind === BlockKind.CODE)
      )
  }, [state.blocks, state.positions])

  const actionBlocks = useMemo(() => {
    return state.positions
      .map((id) => state.blocks[id])
      .filter(
        (block): block is Block =>
          Boolean(block) && block.kind === BlockKind.CODE
      )
  }, [state.blocks, state.positions])

  const fileBlocks = useMemo(() => {
    return state.positions
      .map((id) => state.blocks[id])
      .filter(
        (block): block is Block =>
          Boolean(block) && block.kind === BlockKind.FILE_SEARCH_RESULTS
      )
  }, [state.blocks, state.positions])

  const useColumns = () => {
    return {
      chat: chatBlocks,
      actions: actionBlocks,
      files: fileBlocks,
    }
  }

  const createOutputBlock = (inputBlock: Block) => {
    const b = clone(BlockSchema, inputBlock)
    b.outputs = inputBlock.outputs.map((o) =>
      create(BlockOutputSchema, {
        items: o.items.map((i) => create(BlockOutputItemSchema, i)),
        kind: o.kind,
      })
    )
    return b
  }

  const streamGenerateResults = async (blocks: Block[]) => {
    const req: GenerateRequest = create(GenerateRequestSchema, {
      blocks,
      previousResponseId: previousResponseId,
    })

    try {
      const res = client!.generate(req)
      for await (const r of res) {
        for (const b of r.blocks) {
          setIsTyping(false)
          updateBlock(b)
        }
        setPreviousResponseId(r.responseId)
      }
    } catch (e) {
      console.log(e)
    } finally {
      setIsTyping(false)
      setIsInputDisabled(false)
    }
  }

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
    setIsInputDisabled(true)
    setIsTyping(true)

    await streamGenerateResults([userBlock])
  }

  const sendOutputBlock = async (outputBlock: Block) => {
    if (outputBlock.outputs.length === 0) {
      return
    }

    console.log(
      'sending output block',
      outputBlock.id,
      'previousResponseId',
      previousResponseId
    )
    setIsInputDisabled(true)
    setIsTyping(true)

    await streamGenerateResults([outputBlock])
  }

  const updateBlock = (block: Block) => {
    setState((prev) => {
      if (!prev.blocks[block.id]) {
        return {
          blocks: {
            ...prev.blocks,
            [block.id]: block,
          },
          positions: [...prev.positions, block.id],
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

  const addCodeBlock = () => {
    const block = create(BlockSchema, {
      id: `code_${uuidv4()}`,
      role: BlockRole.USER,
      kind: BlockKind.CODE,
      contents: '',
    })

    updateBlock(block)
  }

  const runCodeBlock = (block: Block) => {
    // Find the corresponding action block and trigger its runCode function
    const actionBlock = actionBlocks.find((b) => b.id === block.id)
    if (actionBlock) {
      // This will be handled by the Action component
      const event = new CustomEvent('runCodeBlock', {
        detail: { blockId: block.id },
      })
      window.dispatchEvent(event)
    }
  }

  return (
    <BlockContext.Provider
      value={{
        useColumns,
        sendOutputBlock,
        createOutputBlock,
        sendUserBlock,
        addCodeBlock,
        isInputDisabled,
        isTyping,
        runCodeBlock,
      }}
    >
      {children}
    </BlockContext.Provider>
  )
}

const TypingBlock = create(BlockSchema, {
  kind: BlockKind.MARKUP,
  role: BlockRole.ASSISTANT,
  contents: '...',
})

export { type Block, BlockRole, BlockKind, BlockOutputKind, TypingBlock }
