import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Editor from '@monaco-editor/react'
import { Box, Button, Card, ScrollArea, Text } from '@radix-ui/themes'
import { v4 as uuidv4 } from 'uuid'

import { Block, BlockOutputKind, useBlock } from '../../contexts/BlockContext'
import Console from '../Runme/Console'
import {
  ErrorIcon,
  PlayIcon,
  PlusIcon,
  SpinnerIcon,
  SuccessIcon,
} from './icons'

const fontSize = 14
const fontFamily = 'monospace'

function RunActionButton({
  pid,
  exitCode,
  onClick,
}: {
  pid: number | null
  exitCode: number | null
  onClick: () => void
}) {
  return (
    <Button variant="soft" onClick={onClick}>
      {exitCode === null && pid === null && <PlayIcon />}
      {exitCode === null && pid !== null && (
        <div className="animate-spin">
          <SpinnerIcon />
        </div>
      )}
      {exitCode !== null && exitCode === 0 && <SuccessIcon />}
      {exitCode !== null && exitCode > 0 && <ErrorIcon exitCode={exitCode} />}
    </Button>
  )
}

const CodeConsole = memo(
  ({
    className,
    value,
    runID,
    takeFocus = false,
    onStdout,
    onStderr,
    onExitCode,
    onPid,
    onMimeType,
  }: {
    className?: string
    value: string
    runID: string
    takeFocus?: boolean
    onStdout: (data: Uint8Array) => void
    onStderr: (data: Uint8Array) => void
    onExitCode: (code: number) => void
    onPid: (pid: number) => void
    onMimeType: (mimeType: string) => void
  }) => {
    return (
      value != '' &&
      runID != '' && (
        <Console
          className={className}
          rows={14}
          commands={value.split('\n')}
          fontSize={fontSize}
          fontFamily={fontFamily}
          takeFocus={takeFocus}
          onPid={onPid}
          onStdout={onStdout}
          onStderr={onStderr}
          onExitCode={onExitCode}
          onMimeType={onMimeType}
        />
      )
    )
  },
  (prevProps, nextProps) => {
    return (
      JSON.stringify(prevProps.value) === JSON.stringify(nextProps.value) &&
      prevProps.runID === nextProps.runID
    )
  }
)

// CodeEditor component for editing code which won't re-render unless the value changes
const CodeEditor = memo(
  ({
    id,
    value,
    onChange,
    onEnter,
  }: {
    id: string
    value: string
    onChange: (value: string) => void
    onEnter: () => void
  }) => {
    // Store the latest onEnter in a ref to ensure late binding
    const onEnterRef = useRef(onEnter)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editorRef = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState('140px')
    const [isResizing, setIsResizing] = useState(false)
    const startYRef = useRef(0)
    const startHeightRef = useRef(0)

    // Keep the ref updated with the latest onEnter
    useEffect(() => {
      onEnterRef.current = onEnter
    }, [onEnter])

    // Handle resize events
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return

        const deltaY = e.clientY - startYRef.current
        const newHeight = Math.max(100, startHeightRef.current + deltaY)
        setHeight(`${newHeight}px`)

        // Resize the editor
        if (editorRef.current) {
          editorRef.current.layout()
        }
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.body.style.cursor = 'default'
      }

      if (isResizing) {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      }

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }, [isResizing])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editorDidMount = (editor: any, monaco: any) => {
      editorRef.current = editor

      if (!monaco?.editor) {
        return
      }
      monaco.editor.setTheme('vs-dark')

      if (!editor) {
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.onKeyDown((event: any) => {
        if (event.ctrlKey && event.keyCode === 3) {
          // Use the ref to ensure we always have the latest onEnter
          onEnterRef.current()
        }
      })
    }

    const handleResizeStart = (e: React.MouseEvent) => {
      setIsResizing(true)
      startYRef.current = e.clientY
      startHeightRef.current = containerRef.current?.clientHeight || 140
      document.body.style.cursor = 'ns-resize'
      e.preventDefault()
    }

    return (
      <div className="pb-1 w-full" ref={containerRef}>
        <div className="rounded-md overflow-hidden">
          <Editor
            key={id}
            height={height}
            width="100%"
            defaultLanguage="shellscript"
            value={value}
            options={{
              minimap: { enabled: false },
              theme: 'vs-dark',
              wordWrap: 'wordWrapColumn',
              fontSize,
              fontFamily,
              lineHeight: 20,
            }}
            onChange={(v) => v && onChange?.(v)}
            onMount={editorDidMount}
            className="rounded-lg"
            wrapperProps={{ className: 'rounded-lg' }}
          />
        </div>
        <div
          className="h-2 w-full cursor-ns-resize"
          onMouseDown={handleResizeStart}
        />
      </div>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.value === nextProps.value
  }
)

// Action is an editor and an optional Runme console
function Action({ block }: { block: Block }) {
  const { createOutputBlock, sendOutputBlock } = useBlock()
  const [editorValue, setEditorValue] = useState(block.contents)
  const [takeFocus, setTakeFocus] = useState(false)
  const [exec, setExec] = useState<{ value: string; runID: string }>({
    value: '',
    runID: '',
  })
  const [pid, setPid] = useState<number | null>(null)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [stdout, setStdout] = useState<string>('')
  const [stderr, setStderr] = useState<string>('')
  const [lastRunID, setLastRunID] = useState<string>('')

  const runCode = useCallback(
    (takeFocus = false) => {
      setStdout('')
      setStderr('')
      setPid(null)
      setExitCode(null)
      setExec({ value: editorValue, runID: uuidv4() })
      setTakeFocus(takeFocus)
    },
    [editorValue]
  )

  // Listen for runCodeBlock events
  useEffect(() => {
    const handleRunCodeBlock = (event: CustomEvent) => {
      if (event.detail.blockId === block.id) {
        runCode()
      }
    }

    window.addEventListener('runCodeBlock', handleRunCodeBlock as EventListener)
    return () => {
      window.removeEventListener(
        'runCodeBlock',
        handleRunCodeBlock as EventListener
      )
    }
  }, [block.id, runCode])

  const finalOutputBlock = useMemo(() => {
    if (
      pid === null ||
      exitCode === null ||
      exec.runID === '' ||
      !Number.isFinite(pid) ||
      !Number.isInteger(exitCode)
    ) {
      return null
    }

    const outputBlock = createOutputBlock({
      ...block,
      outputs: [
        {
          $typeName: 'BlockOutput',
          kind: BlockOutputKind.STDOUT,
          items: [
            {
              $typeName: 'BlockOutputItem',
              mime: mimeType || 'text/plain',
              textData: stdout,
            },
          ],
        },
        {
          $typeName: 'BlockOutput',
          kind: BlockOutputKind.STDERR,
          items: [
            {
              $typeName: 'BlockOutputItem',
              mime: mimeType || 'text/plain',
              textData: stderr,
            },
          ],
        },
      ],
    })

    return outputBlock
  }, [
    block,
    createOutputBlock,
    stdout,
    stderr,
    mimeType,
    pid,
    exitCode,
    exec.runID,
  ])

  useEffect(() => {
    // avoid infinite loop
    if (!finalOutputBlock || lastRunID === exec.runID) {
      return
    }

    setLastRunID(exec.runID)
    sendOutputBlock(finalOutputBlock)
  }, [sendOutputBlock, finalOutputBlock, exec.runID, lastRunID])

  useEffect(() => {
    setEditorValue(block.contents)
  }, [block.contents])

  return (
    <div>
      <Box className="w-full p-2">
        <div className="flex justify-between items-top">
          <RunActionButton
            pid={pid}
            exitCode={exitCode}
            onClick={() => {
              runCode(true)
            }}
          />
          <Card className="whitespace-nowrap overflow-hidden flex-1 ml-2">
            <CodeEditor
              id={block.id}
              value={editorValue}
              onChange={(v) => {
                setPid(null)
                setExitCode(null)
                setEditorValue(v)
              }}
              onEnter={runCode}
            />
            <CodeConsole
              key={exec.runID}
              runID={exec.runID}
              value={exec.value}
              takeFocus={takeFocus}
              onStdout={(data: Uint8Array) =>
                setStdout((prev) => prev + new TextDecoder().decode(data))
              }
              onStderr={(data: Uint8Array) =>
                setStderr((prev) => prev + new TextDecoder().decode(data))
              }
              onPid={setPid}
              onExitCode={setExitCode}
              onMimeType={setMimeType}
              className="rounded-md overflow-hidden"
            />
          </Card>
        </div>
      </Box>
    </div>
  )
}

function Actions() {
  const { useColumns, addCodeBlock } = useBlock()
  const { actions } = useColumns()

  const actionsEndRef = useRef<HTMLDivElement | null>(null)
  // automatically scroll to bottom of chat
  const scrollToBottom = () => {
    actionsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [actions])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-2">
        <Text size="5" weight="bold" className="pr-2">
          Actions
        </Text>
        <Button
          variant="ghost"
          size="1"
          className="cursor-pointer"
          onClick={addCodeBlock}
        >
          <PlusIcon />
        </Button>
      </div>
      <ScrollArea type="auto" scrollbars="vertical" className="flex-1 p-2">
        {actions.map((action) => (
          <Action key={action.id} block={action} />
        ))}
        <div ref={actionsEndRef} className="h-1" />
      </ScrollArea>
    </div>
  )
}

export default Actions
