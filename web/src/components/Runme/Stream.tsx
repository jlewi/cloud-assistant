/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ExecuteRequest,
  ExecuteResponse,
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
import { v4 as uuidv4 } from 'uuid'
import { VSCodeEvent } from 'vscode-notebook-renderer/events'

import {
  SocketRequest,
  SocketRequestSchema,
  SocketResponse,
  SocketResponseSchema,
} from '../../gen/es/cassie/sockets_pb'
import { Code } from '../../gen/es/google/rpc/code_pb'
import { getTokenValue } from '../../token'
// @ts-expect-error because the webcomponents are not typed
import { ClientMessages } from './renderers/client'

class Stream {
  private callback: VSCodeEvent<any> | undefined

  public readonly streamID: string

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
    private readonly knownID: string,
    private readonly runID: string,
    private readonly runnerEndpoint: string
  ) {
    // uniquely identify the stream in a URL friendly way
    this.streamID = uuidv4().replace(/-/g, '')

    this._stdoutConnectable.connect()
    this._stderrConnectable.connect()
    this._exitCodeConnectable.connect()
    this._pidConnectable.connect()
    this._mimeTypeConnectable.connect()

    const ws = connectable(
      new Observable<WebSocket>((subscriber) => {
        const url = new URL(this.runnerEndpoint)
        url.searchParams.set('id', this.streamID)
        url.searchParams.set('runID', this.runID)
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
                'runme.dev/id': this.knownID,
                data: response.stdoutData,
              },
            } as any)
            this._stdout.next(response.stdoutData)
          }

          if (response.stderrData && response.stderrData.length > 0) {
            this.callback?.({
              type: ClientMessages.terminalStderr,
              output: {
                'runme.dev/id': this.knownID,
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
            `✅ Connected WebSocket for block ${this.knownID} with runID ${this.runID}`
          )
          subscriber.next(socket)
        }

        return () => {
          console.log(
            new Date(),
            `☑️ Cleanly disconnected WebSocket for block ${this.knownID} with runID ${this.runID}`
          )

          // Complete so that any subscribers can unsubscribe
          this._stdout.complete()
          this._stderr.complete()
          this._exitCode.complete()
          this._pid.complete()
          this._mimeType.complete()

          socket.close()
        }
      })
    )
    // Hold handle to main subscription to close the websocket when the stream is closed
    this.connected = ws.connect()

    // Makes sure messages are buffered until the socket is open, then sent
    const socketIsOpen = ws.pipe(
      filter((socket) => socket.readyState === WebSocket.OPEN),
      take(1)
    )

    // Buffer messages until the socket is open, then emit them as an array
    const buffered = this.queue.pipe(
      bufferWhen(() => socketIsOpen),
      filter((buffer) => buffer.length > 0), // Only emit if there are buffered messages
      map((buffer) =>
        // Sort to send requests with config first
        buffer.sort((a, b) => {
          const hasConfig = (req: SocketRequest) => !!req.payload.value?.config
          return hasConfig(b) ? 1 : hasConfig(a) ? -1 : 0
        })
      )
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
        // Use mergeMap to flatten
        mergeMap((buffer) => buffer)
      ),
      passthrough
    )

    // Now send messages as before
    const sender = merged.pipe(
      withLatestFrom(ws),
      map(([req, socket]) => {
        // knownID is important to track the origin cell/block of the request.
        req.knownId = this.knownID
        // runID is important to identify the specific execution of the request.
        req.runId = this.runID

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

    // This will make sender's subscriber log
    // sender.subscribe(console.log)

    // Subscribe to the sender without logging
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

export default Stream
