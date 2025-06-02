import { memo, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import {
  Button,
  Callout,
  Flex,
  ScrollArea,
  Text,
  TextField,
} from '@radix-ui/themes'

import {
  Block,
  BlockKind,
  BlockRole,
  TypingBlock,
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

const UserMessage = ({ block }: { block: Block }) => {
  return (
    <MessageContainer role={BlockRole.USER}>{block.contents}</MessageContainer>
  )
}

const AssistantMessage = ({ block }: { block: Block }) => {
  return (
    <MessageContainer role={BlockRole.ASSISTANT}>
      <Markdown
        components={{
          code: ({ children, ...props }) => {
            return (
              <pre className="whitespace-pre-wrap">
                <code {...props}>{String(children).replace(/\n$/, '')}</code>
              </pre>
            )
          },
        }}
      >
        {block.contents}
      </Markdown>
    </MessageContainer>
  )
}

const CodeMessage = memo(
  ({
    block,
    isLastCodeBlock,
    onClick,
  }: {
    block: Block
    isLastCodeBlock?: boolean
    onClick?: () => void
  }) => {
    const { runCodeBlock } = useBlock()
    const firstLine = block.contents.split(/&&|;|\n|\\n/)[0]

    const handleClick = () => {
      if (onClick) {
        onClick()
      } else {
        runCodeBlock(block)
      }
    }

    return (
      <div className="self-start flex flex-row items-center gap-1">
        <div
          className="flex items-center gap-2 m-1 p-2 bg-[#1e1e1e] rounded-md max-w-[80%] cursor-pointer"
          onClick={handleClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d4d4d4"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d4d4d4"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-1"
          >
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span className="text-sm text-[#d4d4d4] italic truncate max-w-2/3">
            {firstLine}
          </span>
        </div>
        {isLastCodeBlock && (
          <span className="text-xs text-gray-400">Press CTRL+ENTER to run</span>
        )}
      </div>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.block.id === nextProps.block.id &&
      JSON.stringify(prevProps.block.contents) ===
        JSON.stringify(nextProps.block.contents) &&
      prevProps.isLastCodeBlock === nextProps.isLastCodeBlock
    )
  }
)

const Message = ({
  block,
  isLastCodeBlock,
}: MessageProps & { isLastCodeBlock?: boolean }) => {
  if (block.kind === BlockKind.CODE) {
    return (
      <CodeMessage
        key={block.id}
        block={block}
        isLastCodeBlock={isLastCodeBlock}
      />
    )
  }

  switch (block.role) {
    case BlockRole.USER:
      return <UserMessage block={block} />
    case BlockRole.ASSISTANT:
      return <AssistantMessage block={block} />
    default:
      return null
  }
}

const ChatMessages = () => {
  const { useColumns, isTyping, runCodeBlock } = useBlock()
  const { chat } = useColumns()
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const outerDivRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chat])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter') {
        const lastBlock = chat[chat.length - 1]
        if (lastBlock?.kind === BlockKind.CODE) {
          runCodeBlock(lastBlock)
        }
      }
    }

    const outerDiv = outerDivRef.current
    if (outerDiv) {
      outerDiv.addEventListener('keydown', handleKeyDown)
      return () => outerDiv.removeEventListener('keydown', handleKeyDown)
    }
  }, [chat, runCodeBlock])

  if (chat.length === 0) return null

  return (
    <div
      ref={outerDivRef}
      className="overflow-y-clip p-1 flex flex-col order-2 whitespace-pre-wrap"
    >
      {chat.map((msg: Block, index: number) => (
        <Message
          key={index}
          block={msg}
          isLastCodeBlock={
            msg.kind === BlockKind.CODE &&
            index === chat.length - 1 &&
            !isTyping
          }
        />
      ))}
      {isTyping && (
        <div className="flex justify-start items-center h-full">
          <Message block={TypingBlock} />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

const ChatInput = () => {
  const { sendUserBlock, isInputDisabled } = useBlock()
  const [userInput, setUserInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userInput.trim()) return
    sendUserBlock(userInput)
    setUserInput('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full order-1">
      <Flex className="w-full flex flex-nowrap items-center">
        <TextField.Root
          name="userInput"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter your question"
          size="2"
          className="flex-grow min-w-0 m-2"
          ref={inputRef}
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
  )
}

function Chat() {
  const { useColumns, runCodeBlock } = useBlock()
  const { chat } = useColumns()
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const outerDivRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chat])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter') {
        const lastBlock = chat[chat.length - 1]
        if (lastBlock?.kind === BlockKind.CODE) {
          runCodeBlock(lastBlock)
        }
      }
    }

    const outerDiv = outerDivRef.current
    if (outerDiv) {
      outerDiv.addEventListener('keydown', handleKeyDown)
      return () => outerDiv.removeEventListener('keydown', handleKeyDown)
    }
  }, [chat, runCodeBlock])

  return (
    <div ref={outerDivRef} className="flex flex-col h-full">
      <Text size="5" weight="bold" className="mb-2">
        How can I help you?
      </Text>
      <ScrollArea type="auto" scrollbars="vertical" className="flex-1 p-4">
        <div className="flex flex-col-reverse h-full w-full">
          <ChatMessages />
          <ChatInput />
        </div>
      </ScrollArea>
    </div>
  )
}

export default Chat
