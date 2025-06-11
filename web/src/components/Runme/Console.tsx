/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from 'react'

import { CommandMode } from '@buf/stateful_runme.bufbuild_es/runme/runner/v2/config_pb'
import {
  ExecuteRequestSchema,
  SessionStrategy,
  WinsizeSchema,
} from '@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb'
import { create } from '@bufbuild/protobuf'
import { RendererContext } from 'vscode-notebook-renderer'
import { VSCodeEvent } from 'vscode-notebook-renderer/events'

import { useSettings } from '../../contexts/SettingsContext'
import Stream from './Stream'
// anything below is required for the webcomponents to work
import './renderers/client'
// @ts-expect-error because the webcomponents are not typed
import { ClientMessages, setContext } from './renderers/client'
import './runme-vscode.css'

function Console({
  blockID,
  runID,
  commands,
  rows = 20,
  className,
  fontSize = 12,
  fontFamily = 'monospace',
  takeFocus = true,
  onStdout,
  onStderr,
  onExitCode,
  onPid,
  onMimeType,
}: {
  blockID: string
  runID: string
  commands: string[]
  rows?: number
  className?: string
  fontSize?: number
  fontFamily?: string
  takeFocus?: boolean
  onStdout?: (data: Uint8Array) => void
  onStderr?: (data: Uint8Array) => void
  onExitCode?: (code: number) => void
  onPid?: (pid: number) => void
  onMimeType?: (mimeType: string) => void
}) {
  const { settings } = useSettings()
  const stream = useMemo(() => {
    if (!blockID || !runID || !settings.runnerEndpoint) {
      return undefined
    }

    console.log('Creating stream', blockID, runID, settings.runnerEndpoint)
    return new Stream(blockID, runID, settings.runnerEndpoint)
  }, [blockID, runID, settings.runnerEndpoint])

  useEffect(() => {
    // connect a single stream
    stream?.connect()
  }, [stream])

  let winsize = create(WinsizeSchema, {
    rows: 34,
    cols: 100,
    x: 0,
    y: 0,
  })

  const executeRequest = useMemo(() => {
    return create(ExecuteRequestSchema, {
      sessionStrategy: SessionStrategy.MOST_RECENT, // without this every exec gets its own session
      storeStdoutInEnv: true,
      config: {
        languageId: 'sh',
        background: false,
        fileExtension: '',
        env: [`RUNME_ID=${blockID}`, 'RUNME_RUNNER=v2', 'TERM=xterm-256color'],
        source: {
          case: 'commands',
          value: {
            items: commands,
          },
        },
        interactive: true,
        mode: CommandMode.INLINE,
        knownId: blockID,
        // knownName: "the-block-name",
      },
      winsize,
    })
  }, [blockID, commands, winsize])

  const webComponentDefaults = useMemo(
    () => ({
      output: {
        'runme.dev/id': executeRequest.config?.knownId,
        fontFamily: fontFamily || 'monospace',
        fontSize: fontSize || 12,
        cursorStyle: 'block',
        cursorBlink: true,
        cursorWidth: 1,
        takeFocus,
        smoothScrollDuration: 0,
        scrollback: 1000,
        initialRows: rows,
        content: '',
        isAutoSaveEnabled: false,
        isPlatformAuthEnabled: false,
      },
    }),
    [fontFamily, fontSize, takeFocus, rows, executeRequest.config?.knownId]
  )

  const encoder = new TextEncoder()

  setContext({
    postMessage: (message: unknown) => {
      if (
        (message as any).type === ClientMessages.terminalOpen ||
        (message as any).type === ClientMessages.terminalResize
      ) {
        const cols = Number((message as any).output.terminalDimensions.columns)
        const rows = Number((message as any).output.terminalDimensions.rows)
        if (Number.isFinite(cols) && Number.isFinite(rows)) {
          // If the dimensions are the same, return early
          if (winsize.cols === cols && winsize.rows === rows) {
            return
          }
          winsize = create(WinsizeSchema, {
            cols,
            rows,
            x: 0,
            y: 0,
          })
          const req = create(ExecuteRequestSchema, {
            winsize,
          })
          stream?.sendExecuteRequest(req)
        }
      }

      if ((message as any).type === ClientMessages.terminalStdin) {
        const inputData = encoder.encode((message as any).output.input)
        const req = create(ExecuteRequestSchema, { inputData })
        // const reqJson = toJson(ExecuteRequestSchema, req)
        // console.log('terminalStdin', reqJson)
        stream?.sendExecuteRequest(req)
      }
    },
    onDidReceiveMessage: (listener: VSCodeEvent<any>) => {
      stream?.setCallback(listener)
    },
  } as Partial<RendererContext<void>>)

  useEffect(() => {
    const stdoutSub = stream?.stdout.subscribe((data: Uint8Array) => {
      onStdout?.(data)
    })
    return () => stdoutSub?.unsubscribe()
  }, [stream, onStdout])

  useEffect(() => {
    const stderrSub = stream?.stderr.subscribe((data: Uint8Array) => {
      onStderr?.(data)
    })
    return () => stderrSub?.unsubscribe()
  }, [stream, onStderr])

  useEffect(() => {
    const exitCodeSub = stream?.exitCode.subscribe((code: number) => {
      onExitCode?.(code)
    })
    return () => exitCodeSub?.unsubscribe()
  }, [stream, onExitCode])

  useEffect(() => {
    const pidSub = stream?.pid.subscribe((pid: number) => {
      onPid?.(pid)
    })
    return () => pidSub?.unsubscribe()
  }, [stream, onPid])

  useEffect(() => {
    const mimeTypeSub = stream?.mimeType.subscribe((mimeType: string) => {
      onMimeType?.(mimeType)
    })
    return () => mimeTypeSub?.unsubscribe()
  }, [stream, onMimeType])

  useEffect(() => {
    if (!stream || !executeRequest) {
      return
    }
    console.log(
      'useEffect invoked - Commands changed:',
      JSON.stringify(executeRequest.config!.source!.value)
    )
    stream?.sendExecuteRequest(executeRequest)
  }, [executeRequest, stream])

  return (
    <div
      className={className}
      ref={(el) => {
        if (!el || el.hasChildNodes()) {
          return
        }
        const terminalElem = document.createElement('terminal-view')
        terminalElem.setAttribute('buttons', 'false')

        terminalElem.setAttribute(
          'id',
          webComponentDefaults.output['runme.dev/id']!
        )
        terminalElem.setAttribute(
          'fontFamily',
          webComponentDefaults.output.fontFamily
        )
        if (typeof webComponentDefaults.output.fontSize === 'number') {
          terminalElem.setAttribute(
            'fontSize',
            webComponentDefaults.output.fontSize.toString()
          )
        }
        if (webComponentDefaults.output.cursorStyle) {
          terminalElem.setAttribute(
            'cursorStyle',
            webComponentDefaults.output.cursorStyle
          )
        }
        if (typeof webComponentDefaults.output.cursorBlink === 'boolean') {
          terminalElem.setAttribute(
            'cursorBlink',
            webComponentDefaults.output.cursorBlink ? 'true' : 'false'
          )
        }
        if (typeof webComponentDefaults.output.cursorWidth === 'number') {
          terminalElem.setAttribute(
            'cursorWidth',
            webComponentDefaults.output.cursorWidth.toString()
          )
        }

        if (typeof webComponentDefaults.output.takeFocus === 'boolean') {
          terminalElem.setAttribute(
            'takeFocus',
            webComponentDefaults.output.takeFocus ? 'true' : 'false'
          )
        }

        if (
          typeof webComponentDefaults.output.smoothScrollDuration === 'number'
        ) {
          terminalElem.setAttribute(
            'smoothScrollDuration',
            webComponentDefaults.output.smoothScrollDuration.toString()
          )
        }

        if (typeof webComponentDefaults.output.scrollback === 'number') {
          terminalElem.setAttribute(
            'scrollback',
            webComponentDefaults.output.scrollback.toString()
          )
        }
        if (webComponentDefaults.output.initialRows !== undefined) {
          terminalElem.setAttribute(
            'initialRows',
            webComponentDefaults.output.initialRows.toString()
          )
        }

        if (webComponentDefaults.output.content !== undefined) {
          terminalElem.setAttribute(
            'initialContent',
            webComponentDefaults.output.content
          )
        }

        if (webComponentDefaults.output.isAutoSaveEnabled) {
          terminalElem.setAttribute(
            'isAutoSaveEnabled',
            webComponentDefaults.output.isAutoSaveEnabled.toString()
          )
        }

        if (webComponentDefaults.output.isPlatformAuthEnabled) {
          terminalElem.setAttribute(
            'isPlatformAuthEnabled',
            webComponentDefaults.output.isPlatformAuthEnabled.toString()
          )
        }

        el.appendChild(terminalElem)
        const terminalEnd = document.createElement('div')
        terminalEnd.setAttribute('className', 'h-1')
        el.appendChild(terminalEnd)

        setTimeout(() => {
          if (!isInViewport(terminalEnd)) {
            terminalEnd.scrollIntoView({ behavior: 'smooth' })
          }
        }, 0)
      }}
    ></div>
  )
}

function isInViewport(element: Element) {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

export default Console
