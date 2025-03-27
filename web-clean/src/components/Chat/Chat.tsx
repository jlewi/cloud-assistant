import { TextField, Button, Flex, Callout } from '@radix-ui/themes'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { useClient as useAgentClient } from '../../contexts/AgentContext'
import { create as createMessage } from '@bufbuild/protobuf'
import * as blocks_pb from '../../gen/es/cassie/blocks_pb'

type MessageProps = {
  role: 'user' | 'assistant' | 'code'
  text: string
}

const MessageContainer = ({
  role,
  children,
}: {
  role: 'user' | 'assistant' | 'code'
  children: React.ReactNode
}) => {
  const self = role !== 'user' ? 'start' : 'end'
  const color = role !== 'user' ? 'gray' : 'indigo'
  return (
    <Callout.Root
      highContrast
      color={color}
      className={`self-${self} max-w-[80%] break-words m-1`}
    >
      <Callout.Text>{children}</Callout.Text>
    </Callout.Root>
  )
}

const UserMessage = ({ text }: { text: string }) => {
  return <MessageContainer role="user">{text}</MessageContainer>
}

const AssistantMessage = ({ text }: { text: string }) => {
  return (
    <MessageContainer role="assistant">
      <Markdown>{text}</Markdown>
    </MessageContainer>
  )
}

const CodeMessage = ({ text }: { text: string }) => {
  return (
    <MessageContainer role="code">
      {text.split('\n').map((line, index) => (
        <div key={index} className="mt-1">
          <span className="text-[#b8b8b8] mr-2">{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </MessageContainer>
  )
}

const Message = ({ role, text }: MessageProps) => {
  switch (role) {
    case 'user':
      return <UserMessage text={text} />
    case 'assistant':
      return <AssistantMessage text={text} />
    case 'code':
      return <CodeMessage text={text} />
    default:
      return null
  }
}

function Chat() {
  const { client } = useAgentClient()
  const [userInput, setUserInput] = useState('')
  const [messages, setMessages] = useState<MessageProps[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [inputDisabled, setInputDisabled] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [threadId, setThreadId] = useState('1') // dummy thread id

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userInput.trim()) return
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: 'user', text: userInput },
      { role: 'assistant', text: '...' },
    ])
    sendMessage(userInput)
    setUserInput('')
    setInputDisabled(true)
    // scrollToBottom()
  }

  const sendMessage = async (text: string) => {
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

          // Always update the last message if it exists, otherwise add a new one
          const updatedMessages = [...prevMessages]

          if (
            updatedMessages.length > 0 &&
            updatedMessages[updatedMessages.length - 1].role === 'assistant'
          ) {
            // Update existing assistant message
            updatedMessages[updatedMessages.length - 1] = {
              ...updatedMessages[updatedMessages.length - 1],
              text: block.contents,
            }
            return updatedMessages
          } else {
            // Add new assistant message
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
      setInputDisabled(false)
    }
  }

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex flex-col-reverse h-full w-full">
      {messages.length > 0 && (
        <div className="flex-grow overflow-y-auto p-1 flex flex-col order-2 whitespace-pre-wrap">
          {messages.map((msg, index) => (
            <Message key={index} role={msg.role} text={msg.text} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex w-full pb-10 order-1">
        <Flex className="w-full flex flex-nowrap items-center p-2">
          <TextField.Root
            name="userInput"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Enter your question"
            size="2"
            className="flex-grow min-w-0 m-2"
          >
            <TextField.Slot>
              <MagnifyingGlassIcon height="16" width="16" />
            </TextField.Slot>
            {/* <TextField.Slot pr="3">
              <IconButton size="2" variant="ghost">
                <DotsHorizontalIcon height="16" width="16" />
              </IconButton>
            </TextField.Slot> */}
          </TextField.Root>
          <Button type="submit" disabled={inputDisabled}>
            {inputDisabled ? 'Thinking' : 'Send'}
          </Button>
        </Flex>
      </form>
    </div>
  )
}

export default Chat
