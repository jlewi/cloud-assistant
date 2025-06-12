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
  takeWhile,
  timer,
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

export type StreamError = Error | pb.SocketStatus

export enum Heartbeat {
  CONTINUOUS = 'CONTINUOUS',
  INITIAL = 'INITIAL',
}

class Streams {
  private callback: VSCodeEvent<any> | undefined

  private readonly queue = new Subject<pb.SocketRequest>()

  private reconnect = new Subject<{
    streamID: string
    heartbeat: Heartbeat
  }>()
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
    // Turn the connectables into hot observables
    this._errorsConnectable.connect()
    this._stdoutConnectable.connect()
    this._stderrConnectable.connect()
    this._exitCodeConnectable.connect()
    this._pidConnectable.connect()
    this._mimeTypeConnectable.connect()

    // Create a new socket client for each reconnect
    this.client = this.reconnect
      .pipe(
        // switchMap avoids overlapping socket clients; mergeMap would allow overlapping
        switchMap((config) => {
          // construct a new socket client for each reconnect
          return this.createSocketClient(config.streamID).pipe(
            switchMap((socket) => {
              // add a heartbeat to the socket
              return this.withHeartbeat(socket, config.heartbeat)
            })
          )
        })
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
      takeWhile(([, socket]) => socket.readyState === WebSocket.OPEN),
      map(([req, socket]) =>
        sendSocketRequest({
          req,
          socket,
          knownID: this.knownID,
          runID: this.runID,
        })
      )
    )

    sender.subscribe({
      error: (err) => {
        this._errors.next(err)
      },
    })
  }

  // Creates a new socket client for the given streamID.
  // Returns an observable that emits the socket when it is open.
  // The socket is closed when the observable is unsubscribed.
  private createSocketClient(streamID: string) {
    return new Observable<WebSocket>((observer) => {
      const url = new URL(this.runnerEndpoint)
      url.searchParams.set('id', streamID)
      url.searchParams.set('runID', this.runID)
      const socket = new WebSocket(url.toString())

      socket.onclose = (event) => {
        console.log(new Date(), `WebSocket transport ${streamID} closed`, event)
        observer.complete()
      }

      socket.onerror = (event) => {
        console.error(
          new Date(),
          `WebSocket transport ${streamID} error`,
          event
        )
        observer.error(event)
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
          observer.error(status)
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
          observer.complete()
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

        observer.next(socket)
      }

      return () => {
        console.log(
          new Date(),
          `☑️ Cleanly disconnected WebSocket for block ${this.knownID} with runID ${this.runID}`
        )

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
  // If heartbeat is Heartbeat.CONTINUOUS, sends an initial ping immediately and then every 10 seconds.
  // If heartbeat is Heartbeat.INITIAL, sends only a single immediate ping.
  private withHeartbeat(
    socket: WebSocket,
    heartbeat: Heartbeat
  ): Observable<WebSocket> {
    return new Observable<WebSocket>((observer) => {
      const ticks =
        heartbeat === Heartbeat.INITIAL ? timer(0) : timer(0, 10_000)

      // Subscribe to ticks to send heartbeat pings.
      const sub = ticks
        .pipe(
          takeWhile(() => socket.readyState === WebSocket.OPEN),
          map(() => {
            const ping = { timestamp: BigInt(Date.now()) }
            return create(pb.SocketRequestSchema, { ping })
          })
        )
        .subscribe({
          next: (req: pb.SocketRequest) => {
            sendSocketRequest({
              req,
              socket,
              knownID: this.knownID,
              runID: this.runID,
            })
          },
          // complete: () => {
          //   console.log(
          //     `Heartbeat for ${this.knownID} with runID ${this.runID} complete`
          //   )
          // },
          error: (err) => {
            console.error('Unexpected error sending heartbeat', err)
          },
        })

      observer.next(socket)

      return () => {
        sub.unsubscribe()
      }
    })
  }

  // Returns the streamID for the new stream
  public connect(heartbeat = Heartbeat.CONTINUOUS): string {
    const streamID = genStreamID()
    this.reconnect.next({ streamID, heartbeat })
    return streamID
  }
}

// Sends a SocketRequest over a WebSocket after adding knownId, runId, and authorization.
function sendSocketRequest({
  req,
  socket,
  knownID,
  runID,
}: {
  req: pb.SocketRequest
  socket: WebSocket
  knownID: string
  runID: string
}) {
  // knownID is important to track the origin cell/block of the request.
  req.knownId = knownID
  // runID is important to identify the specific execution of the request.
  req.runId = runID
  const token = getTokenValue()
  if (token && req) {
    req.authorization = `Bearer ${token}`
  }
  socket.send(JSON.stringify(toJson(pb.SocketRequestSchema, req)))
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
