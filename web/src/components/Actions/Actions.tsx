import { memo, useCallback, useEffect, useRef, useState } from 'react'

import Editor from '@monaco-editor/react'
import { Box, Button, Card } from '@radix-ui/themes'
import { v4 as uuidv4 } from 'uuid'

import { Block, useBlock } from '../../contexts/BlockContext'
import Console from '../Runme/Console'
import { ErrorIcon, PlayIcon, SpinnerIcon, SuccessIcon } from './icons'

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
    outputHandler,
    exitCodeHandler,
    pidHandler,
    mimeTypeHandler,
  }: {
    className?: string
    value: string
    runID: string
    outputHandler: (data: Uint8Array) => void
    exitCodeHandler: (code: number) => void
    pidHandler: (pid: number) => void
    mimeTypeHandler: (mimeType: string) => void
  }) => {
    return (
      value != '' &&
      runID != '' && (
        <Console
          className={className}
          rows={10}
          commands={value.split('\n')}
          fontSize={fontSize}
          fontFamily={fontFamily}
          onPid={pidHandler}
          onStdout={outputHandler}
          onStderr={outputHandler}
          onExitCode={exitCodeHandler}
          onMimeType={mimeTypeHandler}
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
  const { updateOutputBlock } = useBlock()
  const [editorValue, setEditorValue] = useState(block.contents)
  const [exec, setExec] = useState<{ value: string; runID: string }>({
    value: '',
    runID: '',
  })
  const [pid, setPid] = useState<number | null>(null)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')

  const runCode = useCallback(() => {
    setOutput('')
    setPid(null)
    setExitCode(null)
    setExec({ value: editorValue, runID: uuidv4() })
  }, [editorValue])

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

  useEffect(() => {
    if (exitCode === null || !Number.isInteger(exitCode)) {
      return
    }
    updateOutputBlock(block, {
      mimeType: mimeType || 'text/plain',
      textData: output,
      exitCode,
      runID: exec.runID,
    })
  }, [output, exitCode, mimeType, exec.runID, block, updateOutputBlock])

  useEffect(() => {
    setEditorValue(block.contents)
  }, [block.contents])

  return (
    <div>
      <Box className="w-full p-2">
        <div className="flex justify-between items-top">
          <RunActionButton pid={pid} exitCode={exitCode} onClick={runCode} />
          <Card className="whitespace-nowrap overflow-hidden flex-1 ml-2">
            {/* {title && (
              <div className="flex items-center m-1">
                <span>{title}</span>
              </div>
            )} */}
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
              outputHandler={(data: Uint8Array) =>
                setOutput((prev) => prev + new TextDecoder().decode(data))
              }
              pidHandler={setPid}
              exitCodeHandler={setExitCode}
              mimeTypeHandler={setMimeType}
              className="rounded-md overflow-hidden"
            />
          </Card>
        </div>
      </Box>
    </div>
  )
}

function Actions() {
  const { useColumns } = useBlock()
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
    <>
      {actions.map((action) => (
        <Action key={action.id} block={action} />
      ))}
      <div ref={actionsEndRef} className="h-1" />
    </>
  )
}

export default Actions
