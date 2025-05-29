/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react'

import {
  ExecuteResponse,
  SessionStrategy,
} from '@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb'
import {
  ExecuteRequest,
  ExecuteRequestSchema,
} from '@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb'
import { fromJson, toJson } from '@bufbuild/protobuf'
import { create } from '@bufbuild/protobuf'
import { ulid } from 'ulid'
import { RendererContext } from 'vscode-notebook-renderer'
import { VSCodeEvent } from 'vscode-notebook-renderer/events'

import { useSettings } from '../../contexts/SettingsContext'
import {
  SocketRequest,
  SocketRequestSchema,
  SocketResponse,
  SocketResponseSchema,
} from '../../gen/es/cassie/sockets_pb'
import { Code } from '../../gen/es/google/rpc/code_pb'
import { getTokenValue } from '../../token'
import './renderers/client'
// @ts-expect-error because the webcomponents are not typed
import { ClientMessages, setContext } from './renderers/client'
import './runme-vscode.css'

let socket: WebSocket

// A queue for socket requests.
// We enqueue messages to deal with the case where the socket isn't open yet.
const sendQueue: SocketRequest[] = []

function sendExecuteRequest(socket: WebSocket, execReq: ExecuteRequest) {
  console.log('Sending ExecuteRequest:', execReq)
  const request = create(SocketRequestSchema, {
    payload: {
      value: execReq,
      case: 'executeRequest',
    },
  })

  const token = getTokenValue()

  sendQueue.push(request)
  if (socket.readyState === WebSocket.OPEN) {
    console.log('Socket is open, sending ExecuteRequest')
    // Send all the messages in the queue
    while (sendQueue.length > 0) {
      const req = sendQueue.shift()
      if (token && req) {
        req.authorization = `Bearer ${token}`
      }
      socket.send(JSON.stringify(toJson(SocketRequestSchema, req!)))
    }
  }
}

function buildExecuteRequest(): ExecuteRequest {
  const blockID = ulid()
  return create(ExecuteRequestSchema, {
    sessionStrategy: SessionStrategy.MOST_RECENT, // without this every exec gets its own session
    storeStdoutInEnv: true,
    config: {
      programName: '/bin/zsh', // unset uses system shell
      // arguments: [],
      // directory:
      //     "/Users/sourishkrout/Projects/stateful/oss/vscode-runme/examples",
      languageId: 'sh',
      background: false,
      fileExtension: '',
      env: [`RUNME_ID=${blockID}`, 'RUNME_RUNNER=v2', 'TERM=xterm-256color'],
      source: {
        case: 'commands',
        value: {
          items: [
            // 'for i in {1..10}; do',
            // '  echo "Value: $i"',
            // '  sleep 1',
            // 'done',
            // 'runme',
            'ls -la',
          ],
        },
      },
      interactive: true,
      mode: 1,
      knownId: blockID,
      // knownName: "for-i",
    },
    winsize: { rows: 34, cols: 100, x: 0, y: 0 },
  })
}

function Console({
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
  const { settings, checkRunnerAuth } = useSettings()
  const execReq = buildExecuteRequest()
  const defaults = {
    output: {
      'runme.dev/id': execReq.config?.knownId,
      fontFamily: fontFamily || 'monospace',
      fontSize: fontSize || 12,
      cursorStyle: 'block',
      cursorBlink: true,
      cursorWidth: 1,
      takeFocus,
      // smoothScrollDuration: 100,
      scrollback: 1000,
      initialRows: rows,
      content: '',
      isAutoSaveEnabled: false,
      isPlatformAuthEnabled: false,
    },
  }

  const encoder = new TextEncoder()
  let callback: VSCodeEvent<any> | undefined

  setContext({
    postMessage: (message: unknown) => {
      if (
        (message as any).type === ClientMessages.terminalOpen ||
        (message as any).type === ClientMessages.terminalResize
      ) {
        const columns = Number(
          (message as any).output.terminalDimensions.columns
        )
        const rows = Number((message as any).output.terminalDimensions.rows)
        if (Number.isFinite(columns) && Number.isFinite(rows)) {
          execReq.winsize!.cols = columns
          execReq.winsize!.rows = rows
        }
      }

      if ((message as any).type === ClientMessages.terminalResize) {
        const req = create(ExecuteRequestSchema, {
          winsize: execReq.winsize,
        })
        sendExecuteRequest(socket, req)
      }

      if ((message as any).type === ClientMessages.terminalStdin) {
        const inputData = encoder.encode((message as any).output.input)
        const req = create(ExecuteRequestSchema, { inputData })
        const reqJson = toJson(ExecuteRequestSchema, req)
        console.log('terminalStdin', reqJson)
        sendExecuteRequest(socket, req)
      }
    },
    onDidReceiveMessage: (listener: VSCodeEvent<any>) => {
      callback = listener
    },
  } as Partial<RendererContext<void>>)

  useEffect(() => {
    socket = createWebSocket(settings.runnerEndpoint)

    socket.onclose = (e: CloseEvent) => {
      if (e.code <= 1000) {
        return
      }

      console.error('WebSocket closed with code:', e.code)
      // checkRunnerAuth()
    }

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        console.warn('Unexpected WebSocket message type:', typeof event.data)
        return
      }
      let message: SocketResponse
      try {
        // Parse the string into an object
        const parsed = JSON.parse(event.data)

        // Parse the payload into a Protobuf message
        message = fromJson(SocketResponseSchema, parsed)

        // Use the message
        console.log('Received SocketResponse:', message)
      } catch (err) {
        console.error('Failed to parse SocketResponse:', err)
      }

      const status = message!.status
      if (status && status.code !== Code.OK) {
        console.error(`Runner error ${Code[status.code]}: ${status.message}`)
        socket.close()
        return
      }

      const response = message!.payload.value as ExecuteResponse
      if (response.stdoutData) {
        callback?.({
          type: ClientMessages.terminalStdout,
          output: {
            'runme.dev/id': execReq.config!.knownId,
            data: response.stdoutData,
          },
        } as any)

        if (onStdout) {
          onStdout(response.stdoutData)
        }
      }

      if (response.stderrData) {
        callback?.({
          type: ClientMessages.terminalStderr,
          output: {
            'runme.dev/id': execReq.config!.knownId,
            data: response.stderrData,
          },
        } as any)

        if (onStderr) {
          onStderr(response.stderrData)
        }
      }

      if (response.exitCode !== undefined) {
        if (onExitCode) {
          onExitCode(response.exitCode)
        }
      }

      if (response.pid !== undefined) {
        if (onPid) {
          onPid(response.pid)
        }
      }

      if (response.mimeType) {
        const parts = response.mimeType.split(';')
        const mimeType = parts[0]
        if (onMimeType) {
          onMimeType(mimeType)
        }
      }
    }

    return () => {
      console.log(new Date(), 'Disconnected from WebSocket server')
      socket.close()
    }
  }, [
    callback,
    execReq.config,
    onExitCode,
    onPid,
    onStderr,
    onStdout,
    onMimeType,
    settings.runnerEndpoint,
    checkRunnerAuth,
  ])

  useEffect(() => {
    console.log('useEffect invoked - Commands changed:', commands)
    if (execReq.config?.source?.case === 'commands') {
      execReq.config!.source!.value!.items = commands
    }

    sendExecuteRequest(socket, execReq)
  }, [commands, execReq])
  return (
    <div
      className={className}
      ref={(el) => {
        if (!el || el.hasChildNodes()) {
          return
        }
        const terminalElem = document.createElement('terminal-view')
        terminalElem.setAttribute('buttons', 'false')

        terminalElem.setAttribute('id', defaults.output['runme.dev/id']!)
        terminalElem.setAttribute('fontFamily', defaults.output.fontFamily)
        if (typeof defaults.output.fontSize === 'number') {
          terminalElem.setAttribute(
            'fontSize',
            defaults.output.fontSize.toString()
          )
        }
        if (defaults.output.cursorStyle) {
          terminalElem.setAttribute('cursorStyle', defaults.output.cursorStyle)
        }
        if (typeof defaults.output.cursorBlink === 'boolean') {
          terminalElem.setAttribute(
            'cursorBlink',
            defaults.output.cursorBlink ? 'true' : 'false'
          )
        }
        if (typeof defaults.output.cursorWidth === 'number') {
          terminalElem.setAttribute(
            'cursorWidth',
            defaults.output.cursorWidth.toString()
          )
        }

        if (typeof defaults.output.takeFocus === 'boolean') {
          terminalElem.setAttribute(
            'takeFocus',
            defaults.output.takeFocus ? 'true' : 'false'
          )
        }

        // if (typeof defaults.output.smoothScrollDuration === 'number') {
        //   terminalElem.setAttribute(
        //     'smoothScrollDuration',
        //     defaults.output.smoothScrollDuration.toString(),
        //   )
        // }
        if (typeof defaults.output.scrollback === 'number') {
          terminalElem.setAttribute(
            'scrollback',
            defaults.output.scrollback.toString()
          )
        }
        if (defaults.output.initialRows !== undefined) {
          terminalElem.setAttribute(
            'initialRows',
            defaults.output.initialRows.toString()
          )
        }

        if (defaults.output.content !== undefined) {
          terminalElem.setAttribute('initialContent', defaults.output.content)
        }

        if (defaults.output.isAutoSaveEnabled) {
          terminalElem.setAttribute(
            'isAutoSaveEnabled',
            defaults.output.isAutoSaveEnabled.toString()
          )
        }

        if (defaults.output.isPlatformAuthEnabled) {
          terminalElem.setAttribute(
            'isPlatformAuthEnabled',
            defaults.output.isPlatformAuthEnabled.toString()
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

function createWebSocket(runnerEndpoint: string): WebSocket {
  const url = new URL(runnerEndpoint)
  const ws = new WebSocket(url.toString())

  ws.onerror = (event) => {
    console.error('WebSocket error:', event)
  }

  ws.onclose = (event) => {
    console.error('WebSocket closed:', event)
  }

  ws.onopen = () => {
    console.log(
      new Date(),
      '✅ Connected to Runme WebSocket server at',
      runnerEndpoint
    )

    if (sendQueue.length > 0) {
      console.log('Sending queued messages')
    }

    const token = getTokenValue()
    // Send all the messages in the queue
    // These will be messages that were enqueued before the socket was open.
    // If we try to send a message before the socket is open it will fail and
    // close the connection so we need to enqueue htem.
    while (sendQueue.length > 0) {
      const req = sendQueue.shift()!
      if (token && req) {
        req.authorization = `Bearer ${token}`
      }
      ws.send(JSON.stringify(toJson(SocketRequestSchema, req)))
    }
  }
  return ws
}

export default Console
