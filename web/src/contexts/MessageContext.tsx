import { ReactNode, createContext, useContext, useState } from 'react'

import { create as createMessage } from '@bufbuild/protobuf'

import * as blocks_pb from '../gen/es/cassie/blocks_pb'
import { useClient as useAgentClient } from './AgentContext'

export type Message = {
  role: 'user' | 'assistant' | 'code'
  text: string
}

type MessageContextType = {
  messages: Message[]
  sendMessage: (text: string) => Promise<void>
  isInputDisabled: boolean
}

const MessageContext = createContext<MessageContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useMessage = () => {
  const context = useContext(MessageContext)
  if (!context) {
    throw new Error('useMessage must be used within a MessageProvider')
  }
  return context
}

export const MessageProvider = ({ children }: { children: ReactNode }) => {
  const { client } = useAgentClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [isInputDisabled, setIsInputDisabled] = useState(false)

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    setMessages((prevMessages) => [
      ...prevMessages,
      { role: 'user', text },
      { role: 'assistant', text: '...' },
    ])

    setIsInputDisabled(true)

    const req: blocks_pb.GenerateRequest = createMessage(
      blocks_pb.GenerateRequestSchema,
      {
        blocks: [
          {
            role: blocks_pb.BlockRole.USER,
            kind: blocks_pb.BlockKind.MARKUP,
            contents: text,
          },
        ],
      }
    )

    try {
      const res = client!.generate(req)
      for await (const r of res) {
        const block = r.blocks[r.blocks.length - 1]
        setMessages((prevMessages) => {
          if (!block) return prevMessages

          const updatedMessages = [...prevMessages]

          if (
            updatedMessages.length > 0 &&
            updatedMessages[updatedMessages.length - 1].role === 'assistant'
          ) {
            updatedMessages[updatedMessages.length - 1] = {
              ...updatedMessages[updatedMessages.length - 1],
              text: block.contents,
            }
            return updatedMessages
          } else {
            return [
              ...prevMessages,
              { role: 'assistant', text: block.contents },
            ]
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
    <MessageContext.Provider value={{ messages, sendMessage, isInputDisabled }}>
      {children}
    </MessageContext.Provider>
  )
}
