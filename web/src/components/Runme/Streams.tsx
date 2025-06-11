/* eslint-disable react-refresh/only-export-components */
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
  bufferWhen,
  connectable,
  filter,
  map,
  merge,
  mergeMap,
  share,
  skipUntil,
  switchMap,
  take,
  withLatestFrom,
} from 'rxjs'
import { ulid } from 'ulid'
import { v4 as uuidv4 } from 'uuid'
import { VSCodeEvent } from 'vscode-notebook-renderer/events'

import * as pb from '../../gen/es/cassie/sockets_pb'
import { Code } from '../../gen/es/google/rpc/code_pb'
import { getTokenValue } from '../../token'
// @ts-expect-error because the webcomponents are not typed
import { ClientMessages } from './renderers/client'

export type StreamError = pb.SocketStatus

class Streams {
  private callback: VSCodeEvent<any> | undefined

  private readonly queue = new Subject<pb.SocketRequest>()

  private reconnect = new Subject<string>()
  private client = new Observable<WebSocket>()

  // App protocol-level errors
  private _errors = new Subject<StreamError>()
  private _errorsConnectable = connectable(this._errors.asObservable())

  public get errors() {
    return this._errorsConnectable
  }

  // App protocol-level data streams
  private _stdout = new Subject<Uint8Array>()
  private _stderr = new Subject<Uint8Array>()
  private _exitCode = new Subject<number>()
  private _pid = new Subject<number>()
  private _mimeType = new Subject<string>()

  // Make data streams multicast so that we can subscribe to them multiple times
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
    this._stdoutConnectable.connect()
    this._stderrConnectable.connect()
    this._exitCodeConnectable.connect()
    this._pidConnectable.connect()
    this._mimeTypeConnectable.connect()

    // Create a new socket client for each reconnect
    this.client = this.reconnect
      .pipe(
        // switchMap avoids overlapping socket clients; mergeMap would allow overlapping
        switchMap((streamID) => this.createSocketClient(streamID))
      )
      .pipe(share())

    this.process()
  }

  private process() {
    const socketIsOpen = this.client.pipe(
      filter((socket) => {
        return socket?.readyState === WebSocket.OPEN
      }),
      take(1)
    )

    const buffered = this.queue.pipe(
      bufferWhen(() => socketIsOpen),
      filter((buffer) => buffer.length > 0),
      map((buffer) => {
        // Sort to send requests with config first
        return buffer.sort((a, b) => {
          const hasConfig = (req: pb.SocketRequest) =>
            !!req.payload.value?.config
          return hasConfig(b) ? 1 : hasConfig(a) ? -1 : 0
        })
      })
    )

    // Pass through messages that arrive after the socket is open
    const passthrough = this.queue.pipe(skipUntil(socketIsOpen))

    // Merge the buffered and passthrough streams
    const merged = merge(
      // Flatten buffered arrays
      buffered.pipe(
        // Use mergeMap to flatten
        mergeMap((buffer) => buffer)
      ),
      passthrough
    )

    const sender = merged.pipe(
      withLatestFrom(this.client),
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
        socket.send(JSON.stringify(toJson(pb.SocketRequestSchema, req)))
        return `${new Date().toISOString()}: Sending ${JSON.stringify(
          req.payload.value
        )}`
      })
    )

    sender.subscribe()
  }

  private createSocketClient(streamID: string) {
    return new Observable<WebSocket>((subscriber) => {
      const url = new URL(this.runnerEndpoint)
      url.searchParams.set('id', streamID)
      url.searchParams.set('runID', this.runID)
      const socket = new WebSocket(url.toString())

      socket.onclose = (event) => {
        console.log(new Date(), `WebSocket transport ${streamID} closed`, event)
        subscriber.complete()
      }
      socket.onerror = (event) => {
        console.error(
          new Date(),
          `WebSocket transport ${streamID} error`,
          event
        )
        subscriber.error(event)
      }

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          console.warn('Unexpected WebSocket message type:', typeof event.data)
          return
        }
        let message: pb.SocketResponse
        try {
          // Parse the string into an object
          const parsed = JSON.parse(event.data)

          // Parse the payload into a Protobuf message
          message = fromJson(pb.SocketResponseSchema, parsed)

          // Use the message
          console.log('Received SocketResponse:', message)
        } catch (err) {
          console.error('Failed to parse SocketResponse:', err)
        }

        const status = message!.status
        if (status && status.code !== Code.OK) {
          this._errors.next(status)
          subscriber.complete()
          return
        }

        // Pong is noop
        if (message!.pong) {
          // We could measure latency here
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
          subscriber.complete()
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

        // todo(sebastian): do we need to explicitly complete them with reconnect?
        // Complete so that any subscribers can unsubscribe
        // this._errors.complete()
        // this._stdout.complete()
        // this._stderr.complete()
        // this._exitCode.complete()
        // this._pid.complete()
        // this._mimeType.complete()

        socket.close()
      }
    })
  }

  public setCallback(callback: VSCodeEvent<any>) {
    this.callback = callback
  }

  public sendExecuteRequest(executeRequest: ExecuteRequest) {
    this.queue.next(
      create(pb.SocketRequestSchema, {
        payload: {
          value: executeRequest,
          case: 'executeRequest',
        },
      })
    )
  }

  // Sends periodic heartbeat pings to keep the WebSocket connection alive.
  // If continuous is true, sends an initial ping immediately and then every 10 seconds.
  // If continuous is false, sends only a single immediate ping.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public heartbeat({ continuous }: { continuous: boolean }) {
    // this.ws
    //   .pipe(
    //     filter((socket) => socket?.readyState === WebSocket.OPEN),
    //     switchMap((socket) => {
    //       const ticks = continuous ? timer(0, 1_000) : timer(0)
    //       return ticks.pipe(
    //         map(() => {
    //           const ping = { timestamp: BigInt(Date.now()) }
    //           return create(pb.SocketRequestSchema, { ping })
    //         }),
    //         tap((req) => {
    //           socket.send(JSON.stringify(toJson(pb.SocketRequestSchema, req)))
    //         })
    //       )
    //     })
    //   )
    //   .subscribe({
    //     complete: () => {
    //       console.log(
    //         `Heartbeat for ${this.knownID} with runID ${this.runID} complete`
    //       )
    //     },
    //   })
  }

  // Returns the streamID for the new stream
  public connect(): string {
    const streamID = genStreamID()
    this.reconnect.next(streamID)
    return streamID
  }
}

// Generate a unique ID for the stream
export function genStreamID() {
  return uuidv4().replace(/-/g, '')
}

// Generate a unique ID for the run
export function genRunID() {
  return ulid()
}

export default Streams
