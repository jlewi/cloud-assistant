/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from 'react'

import { CommandMode } from '@buf/stateful_runme.bufbuild_es/runme/runner/v2/config_pb'
import {
  ExecuteResponse,
  SessionStrategy,
  WinsizeSchema,
} from '@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb'
import {
  ExecuteRequest,
  ExecuteRequestSchema,
} from '@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb'
import { fromJson, toJson } from '@bufbuild/protobuf'
import { create } from '@bufbuild/protobuf'
import {
  Observable,
  Subject,
  Subscription,
  bufferWhen,
  connectable,
  filter,
  map,
  merge,
  mergeMap,
  take,
  withLatestFrom,
} from 'rxjs'
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
// anything below is required for the webcomponents to work
import './renderers/client'
// @ts-expect-error because the webcomponents are not typed
import { ClientMessages, setContext } from './renderers/client'
import './runme-vscode.css'

class RunmeStream {
  private callback: VSCodeEvent<any> | undefined

  private readonly connected: Subscription
  private readonly queue = new Subject<SocketRequest>()

  private _stdout = new Subject<Uint8Array>()
  private _stderr = new Subject<Uint8Array>()
  private _exitCode = new Subject<number>()
  private _pid = new Subject<number>()
  private _mimeType = new Subject<string>()

  // Make them multicast so that we can subscribe to them multiple times
  private _stdoutConnectable = connectable(this._stdout.asObservable())
  private _stderrConnectable = connectable(this._stderr.asObservable())
  private _exitCodeConnectable = connectable(this._exitCode.asObservable())
  private _pidConnectable = connectable(this._pid.asObservable())
  private _mimeTypeConnectable = connectable(this._mimeType.asObservable())

  public get stdout() {
    return this._stdoutConnectable
  }
  public get stderr() {
    return this._stderrConnectable
  }
  public get exitCode() {
    return this._exitCodeConnectable
  }
  public get pid() {
    return this._pidConnectable
  }
  public get mimeType() {
    return this._mimeTypeConnectable
  }

  constructor(
    private readonly blockID: string,
    private readonly runID: string,
    private readonly runnerEndpoint: string
  ) {
    this._stdoutConnectable.connect()
    this._stderrConnectable.connect()
    this._exitCodeConnectable.connect()
    this._pidConnectable.connect()
    this._mimeTypeConnectable.connect()

    const ws = connectable(
      new Observable<WebSocket>((subscriber) => {
        const url = new URL(this.runnerEndpoint)
        const socket = new WebSocket(url.toString())

        socket.onclose = () => {
          console.error('WebSocket closed:', event)
          subscriber.complete()
        }
        socket.onerror = (event) => {
          console.error('WebSocket error:', event)
          subscriber.error(event)
        }

        socket.onmessage = (event) => {
          if (typeof event.data !== 'string') {
            console.warn(
              'Unexpected WebSocket message type:',
              typeof event.data
            )
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
            console.error(
              `Runner error ${Code[status.code]}: ${status.message}`
            )
            this.close()
            return
          }

          const response = message!.payload.value as ExecuteResponse
          if (response.stdoutData && response.stdoutData.length > 0) {
            this.callback?.({
              type: ClientMessages.terminalStdout,
              output: {
                'runme.dev/id': this.blockID,
                data: response.stdoutData,
              },
            } as any)
            this._stdout.next(response.stdoutData)
          }

          if (response.stderrData && response.stderrData.length > 0) {
            this.callback?.({
              type: ClientMessages.terminalStderr,
              output: {
                'runme.dev/id': this.blockID,
                data: response.stderrData,
              },
            } as any)
            this._stderr.next(response.stderrData)
          }

          if (response.exitCode !== undefined) {
            this._exitCode.next(response.exitCode)
            this.close()
          }

          if (response.pid !== undefined) {
            this._pid.next(response.pid)
          }

          if (response.mimeType) {
            const parts = response.mimeType.split(';')
            const mimeType = parts[0]
            this._mimeType.next(mimeType)
          }
        }

        socket.onopen = () => {
          console.log(
            new Date(),
            `✅ Connected WebSocket for block ${this.blockID} with runID ${this.runID}`
          )
          subscriber.next(socket)
        }

        return () => {
          console.log(
            new Date(),
            `☑️ Cleanly disconnected WebSocket for block ${this.blockID} with runID ${this.runID}`
          )

          // complete so that any subscribers can unsubscribe
          this._stdout.complete()
          this._stderr.complete()
          this._exitCode.complete()
          this._pid.complete()
          this._mimeType.complete()

          socket.close()
        }
      })
    )
    this.connected = ws.connect()

    // makes sure messages are buffered until the socket is open, then sent
    const socketIsOpen = ws.pipe(
      filter((socket) => socket.readyState === WebSocket.OPEN),
      take(1)
    )

    // Buffer messages until the socket is open, then emit them as an array
    const buffered = this.queue.pipe(
      bufferWhen(() => socketIsOpen),
      filter((buffer) => buffer.length > 0), // Only emit if there are buffered messages
      // Flatten the array of buffered messages into individual emissions
      map((buffer) => buffer)
      // We'll flatten this array in the merge below
    )

    // Pass through messages that arrive after the socket is open
    const passthrough = this.queue.pipe(
      withLatestFrom(ws),
      filter(([, socket]) => socket && socket.readyState === WebSocket.OPEN),
      map(([req]) => req)
    )

    // Merge the buffered and passthrough streams
    const merged = merge(
      // Flatten buffered arrays
      buffered.pipe(
        // Each buffer is an array, so emit each item
        map((buffer) => buffer),
        // Use mergeMap to flatten
        mergeMap((buffer) => buffer)
      ),
      passthrough
    )

    // Now send messages as before
    const sender = merged.pipe(
      withLatestFrom(ws),
      map(([req, socket]) => {
        const token = getTokenValue()
        // Add bearer token, if available
        if (token && req) {
          req.authorization = `Bearer ${token}`
        }
        socket.send(JSON.stringify(toJson(SocketRequestSchema, req)))
        return `${new Date().toISOString()}: Sending ${JSON.stringify(
          req.payload.value
        )}`
      })
    )

    // this will make sender's subscriber log
    // sender.subscribe(console.log)

    // subscribe to the sender without logging
    sender.subscribe()
  }

  public setCallback(callback: VSCodeEvent<any>) {
    this.callback = callback
  }

  public sendExecuteRequest(executeRequest: ExecuteRequest) {
    this.queue.next(
      create(SocketRequestSchema, {
        payload: {
          value: executeRequest,
          case: 'executeRequest',
        },
      })
    )
  }

  public close() {
    this.queue.complete()
    // unsubscribing from the main sub will close the websocket and associated subjects
    this.connected.unsubscribe()
  }
}

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
    return new RunmeStream(blockID, runID, settings.runnerEndpoint)
  }, [blockID, runID, settings.runnerEndpoint])

  useEffect(() => {
    return () => {
      // this will close previous stream, if still open
      stream?.close()
    }
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
          stream.sendExecuteRequest(req)
        }
      }

      if ((message as any).type === ClientMessages.terminalStdin) {
        const inputData = encoder.encode((message as any).output.input)
        const req = create(ExecuteRequestSchema, { inputData })
        // const reqJson = toJson(ExecuteRequestSchema, req)
        // console.log('terminalStdin', reqJson)
        stream.sendExecuteRequest(req)
      }
    },
    onDidReceiveMessage: (listener: VSCodeEvent<any>) => {
      stream.setCallback(listener)
    },
  } as Partial<RendererContext<void>>)

  useEffect(() => {
    const stdoutSub = stream.stdout.subscribe((data) => {
      onStdout?.(data)
    })
    return () => stdoutSub.unsubscribe()
  }, [stream, onStdout])

  useEffect(() => {
    const stderrSub = stream.stderr.subscribe((data) => {
      onStderr?.(data)
    })
    return () => stderrSub.unsubscribe()
  }, [stream, onStderr])

  useEffect(() => {
    const exitCodeSub = stream.exitCode.subscribe((code) => {
      onExitCode?.(code)
    })
    return () => exitCodeSub.unsubscribe()
  }, [stream, onExitCode])

  useEffect(() => {
    const pidSub = stream.pid.subscribe((pid) => {
      onPid?.(pid)
    })
    return () => pidSub.unsubscribe()
  }, [stream, onPid])

  useEffect(() => {
    const mimeTypeSub = stream.mimeType.subscribe((mimeType) => {
      onMimeType?.(mimeType)
    })
    return () => mimeTypeSub.unsubscribe()
  }, [stream, onMimeType])

  useEffect(() => {
    if (!stream || !executeRequest) {
      return
    }
    console.log(
      'useEffect invoked - Commands changed:',
      JSON.stringify(executeRequest.config!.source!.value)
    )
    stream.sendExecuteRequest(executeRequest)
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
