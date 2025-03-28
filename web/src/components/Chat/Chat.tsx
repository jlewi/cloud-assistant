import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { Button, Callout, Flex, TextField } from '@radix-ui/themes'

import { useMessage } from '../../contexts/MessageContext'

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
  const { messages, sendMessage, isInputDisabled } = useMessage()
  const [userInput, setUserInput] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userInput.trim()) return
    sendMessage(userInput)
    setUserInput('')
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
          <Button type="submit" disabled={isInputDisabled}>
            {isInputDisabled ? 'Thinking' : 'Send'}
          </Button>
        </Flex>
      </form>
    </div>
  )
}

export default Chat
