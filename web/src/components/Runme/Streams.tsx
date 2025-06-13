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
  Subscription,
  bufferWhen,
  connectable,
  filter,
  fromEvent,
  map,
  merge,
  mergeMap,
  scan,
  share,
  skipUntil,
  switchMap,
  take,
  takeWhile,
  tap,
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

type ReconnectConfig = {
  streamID: string
  heartbeat: Heartbeat
}

type Latency = {
  streamID: string
  latency: number
}

class Streams {
  private callback: VSCodeEvent<any> | undefined

  private readonly queue = new Subject<pb.SocketRequest>()

  // Transport related
  private reconnect = new Subject<ReconnectConfig>()
  private client = new Observable<WebSocket>()

  // Track transport latencies for each stream.
  private _latencies = new Subject<Latency>()
  private _latenciesConnectable = connectable(
    this._latencies.asObservable().pipe(
      scan((acc, curr) => {
        acc.set(curr.streamID, curr.latency)
        return acc
      }, new Map<string, number>())
    )
  )

  // Returns an observable that emits the latencies for all streams.
  public get latencies() {
    return this._latenciesConnectable
  }

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
    this._latenciesConnectable.connect()
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
              return this.withHeartbeat(socket, config)
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

      // Define event handlers
      const onClose = (event: CloseEvent) => {
        console.log(new Date(), `WebSocket transport ${streamID} closed`, event)
        observer.complete()
      }

      const onError = (event: Event) => {
        console.error(
          new Date(),
          `WebSocket transport ${streamID} error`,
          event
        )
        observer.error(event)
      }

      const onMessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') {
          console.warn('Unexpected WebSocket message type:', typeof event.data)
          return
        }
        let message: pb.SocketResponse
        try {
          message = parseSocketResponse(event.data)
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

      const onOpen = () => {
        console.log(
          new Date(),
          `✅ Connected WebSocket for block ${this.knownID} with runID ${this.runID}`
        )

        observer.next(socket)
      }

      // Attach event listeners
      socket.addEventListener('close', onClose)
      socket.addEventListener('error', onError)
      socket.addEventListener('message', onMessage)
      socket.addEventListener('open', onOpen)

      return () => {
        console.log(
          new Date(),
          `☑️ Cleanly disconnected WebSocket for block ${this.knownID} with runID ${this.runID}`
        )
        socket.removeEventListener('close', onClose)
        socket.removeEventListener('error', onError)
        socket.removeEventListener('message', onMessage)
        socket.removeEventListener('open', onOpen)
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
    { streamID, heartbeat }: ReconnectConfig
  ): Observable<WebSocket> {
    return new Observable<WebSocket>((observer) => {
      const ticks =
        heartbeat === Heartbeat.INITIAL ? timer(0) : timer(0, 10_000)

      // Listen to the websocket's pongs
      const pongsWithTimestamp = fromEvent<MessageEvent>(
        socket,
        'message'
      ).pipe(
        map((event) => parseSocketResponse(event.data)),
        map((message) => message.pong),
        filter((pong) => pong !== undefined),
        map((pong) => ({
          receivedAt: BigInt(Date.now()),
          pong,
        }))
      )

      // Turn ticks into pings.
      const pings = ticks.pipe(
        takeWhile(() => socket.readyState === WebSocket.OPEN),
        map(() => {
          const ping = { timestamp: BigInt(Date.now()) }
          return create(pb.SocketRequestSchema, { ping })
        }),
        tap((req: pb.SocketRequest) => {
          sendSocketRequest({
            req,
            socket,
            // todo(sebastian): not including these saves payload size. do we need them?
            // knownID: this.knownID,
            // runID: this.runID,
          })
        }),
        map((req: pb.SocketRequest) => req.ping),
        share()
      )

      const latency$ = pongsWithTimestamp.pipe(
        withLatestFrom(pings),
        filter(([pong, ping]) => !!pong && !!ping),
        map(([receivedPong, ping]) => {
          const sent = ping!.timestamp
          const received = receivedPong.receivedAt
          if (sent !== receivedPong.pong.timestamp) {
            throw new Error(
              `Heartbeat out of order: sent ${sent} but received ${receivedPong.pong.timestamp} for stream ${streamID}`
            )
          }
          return Number(received - sent)
        })
      )

      const subs: Subscription[] = []

      subs.push(
        latency$.subscribe({
          next: (ms) => {
            this._latencies.next({ streamID, latency: ms })
            // console.log(`Heartbeat latency for streamID ${streamID}: ${ms}ms`)
          },
          error: (err) => {
            this._errors.next(err)
          },
        })
      )

      // Subscribe to pings.
      subs.push(
        pings.subscribe({
          complete: () => {
            console.log(`Heartbeat for streamID ${streamID} complete`)
          },
          error: (err) => {
            console.error('Unexpected error sending heartbeat', err)
          },
        })
      )

      observer.next(socket)

      return () => {
        subs.forEach((sub) => sub.unsubscribe())
      }
    })
  }

  // Returns an observable that emits the latency for the new stream.
  // If the stream is not found, null is emitted.
  public connect(heartbeat = Heartbeat.CONTINUOUS): Observable<Latency | null> {
    const streamID = genStreamID()
    const latency = this.latencies.pipe(
      map((latencies) => {
        const l = latencies.get(streamID)
        if (l === undefined) {
          return null
        }
        return { streamID, latency: l }
      })
    )
    this.reconnect.next({ streamID, heartbeat })
    return latency
  }

  // Closes streams by completing the reconnect and queue subjects.
  public close() {
    this.reconnect.complete()
    this.queue.complete()
  }
}

// Parses a SocketResponse from a string.
function parseSocketResponse(data: string): pb.SocketResponse {
  // Parse the string into an object
  const parsed = JSON.parse(data)
  // Parse the payload into a Protobuf message
  return fromJson(pb.SocketResponseSchema, parsed)
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
  knownID?: string
  runID?: string
}) {
  // knownID tracks the origin cell/block of the request.
  if (knownID) {
    req.knownId = knownID
  }
  // runID identifies the specific execution of the request.
  if (runID) {
    req.runId = runID
  }
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
