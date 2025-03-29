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
  blocks: Block[]
  sendUserBlock: (text: string) => Promise<void>
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
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isInputDisabled, setIsInputDisabled] = useState(false)

  const sendUserBlock = async (text: string) => {
    if (!text.trim()) return

    const userBlock = create(BlockSchema, {
      role: BlockRole.USER,
      kind: BlockKind.MARKUP,
      contents: text,
    })

    const assistantBlock = create(BlockSchema, {
      role: BlockRole.ASSISTANT,
      kind: BlockKind.MARKUP,
      contents: '...',
    })

    setBlocks((prevBlocks) => [...prevBlocks, userBlock, assistantBlock])
    setIsInputDisabled(true)

    const req: GenerateRequest = create(GenerateRequestSchema, {
      blocks: [userBlock],
    })

    try {
      const res = client!.generate(req)
      for await (const r of res) {
        const block = r.blocks[r.blocks.length - 1]
        setBlocks((prevBlocks) => {
          if (!block) return prevBlocks

          const updatedBlocks = [...prevBlocks]

          if (
            updatedBlocks.length > 0 &&
            updatedBlocks[updatedBlocks.length - 1].role === BlockRole.ASSISTANT
          ) {
            updatedBlocks[updatedBlocks.length - 1] = block
            return updatedBlocks
          } else {
            return [...prevBlocks, block]
          }
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsInputDisabled(false)
    }
  }

  return (
    <BlockContext.Provider value={{ blocks, sendUserBlock, isInputDisabled }}>
      {children}
    </BlockContext.Provider>
  )
}

export { type Block, BlockRole, BlockKind }
