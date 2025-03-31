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

import {
  SocketRequest,
  SocketRequestSchema,
  SocketResponse,
  SocketResponseSchema,
} from '../../gen/es/cassie/sockets_pb'
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

  sendQueue.push(request)
  if (socket.readyState === WebSocket.OPEN) {
    console.log('Socket is open, sending ExecuteRequest')
    // Send all the messages in the queue
    while (sendQueue.length > 0) {
      const req = sendQueue.shift()
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
  onStdout,
  onStderr,
  onExitCode,
  onPid,
}: {
  commands: string[]
  rows?: number
  onStdout?: (data: Uint8Array) => void
  onStderr?: (data: Uint8Array) => void
  onExitCode?: (code: number) => void
  onPid?: (pid: number) => void
}) {
  const execReq = buildExecuteRequest()
  const defaults = {
    output: {
      'runme.dev/id': execReq.config?.knownId,
      fontFamily: 'monospace',
      fontSize: 12,
      cursorStyle: 'block',
      cursorBlink: true,
      cursorWidth: 1,
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
      if ((message as any).type === ClientMessages.terminalOpen) {
        const columns = Number(
          (message as any).output.terminalDimensions.columns
        )
        const rows = Number((message as any).output.terminalDimensions.rows)
        if (Number.isFinite(columns) && Number.isFinite(rows)) {
          execReq.winsize!.cols = columns
          execReq.winsize!.rows = rows
        }
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
    // TODO(jlewi): Should make this default to an address based on the current origin
    socket = createWebSocket()

    // socket.onopen = () => {
    //     console.log(new Date(), 'Connected to WebSocket server');
    // };

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

      //const socketResponse = fromJson(SocketResponseSchema, event.data);
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
    }

    return () => {
      console.log(new Date(), 'Disconnected from WebSocket server')
      socket.close()
    }
  }, [callback, execReq.config, onExitCode, onPid, onStderr, onStdout])

  useEffect(() => {
    console.log('useEffect invoked - Commands changed:', commands)
    if (execReq.config?.source?.case === 'commands') {
      execReq.config!.source!.value!.items = commands
    }

    sendExecuteRequest(socket, execReq)
    // // Promise is intended to ensure that the WebSocket is connected before sending the request
    // socketOpenPromise
    //     .then(() => {
    //         console.log("WebSocket is open, sending ExecuteRequest");
    //         sendExecuteRequest(socket, execReq);
    //     })
    //     .catch((err) => {
    //         console.error("❌ WebSocket failed to connect:", err);
    //     });
  }, [commands, execReq])
  return (
    <div
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
      }}
    ></div>
  )
}

function createWebSocket(): WebSocket {
  // TODO(jlewi): Should make this default to an address based on the current origin
  const ws = new WebSocket('ws://localhost:8080/ws')

  ws.onopen = () => {
    console.log(new Date(), '✅ Connected to Runme WebSocket server')

    if (sendQueue.length > 0) {
      console.log('Sending queued messages')
    }

    // Send all the messages in the queue
    // These will be messages that were enqueued before the socket was open.
    // If we try to send a message before the socket is open it will fail and
    // close the connection so we need to enqueue htem.
    while (sendQueue.length > 0) {
      const req = sendQueue.shift()
      ws.send(JSON.stringify(toJson(SocketRequestSchema, req!)))
    }
  }
  return ws
}

export default Console
