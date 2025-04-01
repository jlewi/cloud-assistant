import { ReactNode, createContext, useContext, useMemo, useState } from 'react'

import { clone, create } from '@bufbuild/protobuf'
import { v4 as uuidv4 } from 'uuid'

import {
  Block,
  BlockKind,
  BlockOutputItemSchema,
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
  updateOutputBlock: (
    inputBlock: Block,
    {
      mimeType,
      textData,
      exitCode,
      runID,
    }: { mimeType: string; textData: string; exitCode: number; runID: string }
  ) => void
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

  const updateOutputBlock = (
    inputBlock: Block,
    {
      mimeType,
      textData,
    }: { mimeType: string; textData: string; exitCode: number; runID: string }
  ) => {
    const b = clone(BlockSchema, inputBlock)
    b.outputs = [
      create(BlockOutputSchema, {
        items: [
          ...(b.outputs?.[0]?.items || []),
          create(BlockOutputItemSchema, {
            mime: mimeType,
            textData,
          }),
        ],
      }),
    ]

    // TODO: Disabled until it's clear how the API expects us to handle output
    // sendOutputBlock(b)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sendOutputBlock = async (block: Block) => {
    const req: GenerateRequest = create(GenerateRequestSchema, {
      blocks: [block],
    })

    try {
      const res = client!.generate(req)
      for await (const r of res) {
        for (const b of r.blocks) {
          console.log('b', JSON.stringify(b, null, 1))
          // updateBlock(b)
        }
      }
    } catch (e) {
      console.error(e)
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
      contents: '# Write your bash commands here',
    })

    updateBlock(block)
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
    // todo(sebastian): we'll use UI state for this inside Chat when input's disabled

    //setBlocks((prevBlocks) => [...prevBlocks, userBlock, assistantBlock])
    setIsInputDisabled(true)
    setIsTyping(true)

    const req: GenerateRequest = create(GenerateRequestSchema, {
      blocks: [userBlock],
    })

    try {
      const res = client!.generate(req)
      for await (const r of res) {
        for (const b of r.blocks) {
          setIsTyping(false)
          updateBlock(b)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsTyping(false)
      setIsInputDisabled(false)
    }
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
        updateOutputBlock,
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

export { type Block, BlockRole, BlockKind, TypingBlock }
