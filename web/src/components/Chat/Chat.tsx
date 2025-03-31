import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { Button, Callout, Flex, TextField } from '@radix-ui/themes'

import {
  Block,
  BlockKind,
  BlockRole,
  useBlock,
} from '../../contexts/BlockContext'

type MessageProps = {
  block: Block
}

const MessageContainer = ({
  role,
  children,
}: {
  role: BlockRole
  children: React.ReactNode
}) => {
  const self = role === BlockRole.USER ? 'self-end' : 'self-start'
  const color = role === BlockRole.USER ? 'indigo' : 'gray'
  return (
    <Callout.Root
      highContrast
      color={color}
      className={`${self} max-w-[80%] break-words m-1`}
    >
      <Callout.Text>{children}</Callout.Text>
    </Callout.Root>
  )
}

const UserMessage = ({ contents }: { contents: string }) => {
  return <MessageContainer role={BlockRole.USER}>{contents}</MessageContainer>
}

const AssistantMessage = ({ contents }: { contents: string }) => {
  return (
    <MessageContainer role={BlockRole.ASSISTANT}>
      <Markdown>{contents}</Markdown>
    </MessageContainer>
  )
}

const CodeMessage = ({ contents }: { contents: string }) => {
  return (
    <MessageContainer role={BlockRole.ASSISTANT}>
      {contents.split('\n').map((line, index) => (
        <div key={index} className="mt-1">
          <span className="text-[#b8b8b8] mr-2">{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </MessageContainer>
  )
}

const Message = ({ block }: MessageProps) => {
  if (block.kind === BlockKind.CODE) {
    return <CodeMessage contents={block.contents} />
  }

  switch (block.role) {
    case BlockRole.USER:
      return <UserMessage contents={block.contents} />
    case BlockRole.ASSISTANT:
      return <AssistantMessage contents={block.contents} />
    default:
      return null
  }
}

function Chat() {
  const { useColumns, sendUserBlock: sendMessage, isInputDisabled } = useBlock()
  const [userInput, setUserInput] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userInput.trim()) return
    sendMessage(userInput)
    setUserInput('')
  }

  const { chat } = useColumns()

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => {
    scrollToBottom()
  }, [chat]) // if we passed empty array, it would only run once onMount

  return (
    <div className="flex flex-col-reverse h-full w-full">
      {chat.length > 0 && (
        <div className="flex-grow overflow-y-auto p-1 flex flex-col order-2 whitespace-pre-wrap">
          {chat.map((msg, index) => (
            <Message key={index} block={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex w-full pb-10 order-1">
        <Flex className="w-full flex flex-nowrap items-center">
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
