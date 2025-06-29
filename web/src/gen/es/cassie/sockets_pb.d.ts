// @generated by protoc-gen-es v2.2.3 with parameter "target=js+dts,import_extension=none,json_types=true"
// @generated from file cassie/sockets.proto (syntax proto3)
/* eslint-disable */

import type { GenFile, GenMessage } from "@bufbuild/protobuf/codegenv1";
import type { Message } from "@bufbuild/protobuf";
import type { Code, CodeJson } from "../google/rpc/code_pb";
import type { ExecuteRequest, ExecuteRequestJson, ExecuteResponse, ExecuteResponseJson } from "../runme/runner/v2/runner_pb";

/**
 * Describes the file cassie/sockets.proto.
 */
export declare const file_cassie_sockets: GenFile;

/**
 * Represents socket-level status (e.g., for auth, protocol, or other errors).
 *
 * @generated from message SocketStatus
 */
export declare type SocketStatus = Message<"SocketStatus"> & {
  /**
   * @generated from field: google.rpc.Code code = 1;
   */
  code: Code;

  /**
   * @generated from field: string message = 2;
   */
  message: string;
};

/**
 * Represents socket-level status (e.g., for auth, protocol, or other errors).
 *
 * @generated from message SocketStatus
 */
export declare type SocketStatusJson = {
  /**
   * @generated from field: google.rpc.Code code = 1;
   */
  code?: CodeJson;

  /**
   * @generated from field: string message = 2;
   */
  message?: string;
};

/**
 * Describes the message SocketStatus.
 * Use `create(SocketStatusSchema)` to create a new message.
 */
export declare const SocketStatusSchema: GenMessage<SocketStatus, SocketStatusJson>;

/**
 * Ping message for protocol-level keep-alive
 *
 * @generated from message Ping
 */
export declare type Ping = Message<"Ping"> & {
  /**
   * @generated from field: int64 timestamp = 1;
   */
  timestamp: bigint;
};

/**
 * Ping message for protocol-level keep-alive
 *
 * @generated from message Ping
 */
export declare type PingJson = {
  /**
   * @generated from field: int64 timestamp = 1;
   */
  timestamp?: string;
};

/**
 * Describes the message Ping.
 * Use `create(PingSchema)` to create a new message.
 */
export declare const PingSchema: GenMessage<Ping, PingJson>;

/**
 * Pong message for protocol-level keep-alive response
 *
 * @generated from message Pong
 */
export declare type Pong = Message<"Pong"> & {
  /**
   * @generated from field: int64 timestamp = 1;
   */
  timestamp: bigint;
};

/**
 * Pong message for protocol-level keep-alive response
 *
 * @generated from message Pong
 */
export declare type PongJson = {
  /**
   * @generated from field: int64 timestamp = 1;
   */
  timestamp?: string;
};

/**
 * Describes the message Pong.
 * Use `create(PongSchema)` to create a new message.
 */
export declare const PongSchema: GenMessage<Pong, PongJson>;

/**
 * SocketRequest defines the message sent by the client over a websocket.
 * The request is a union of types that indicate the type of message.
 *
 * @generated from message SocketRequest
 */
export declare type SocketRequest = Message<"SocketRequest"> & {
  /**
   * @generated from oneof SocketRequest.payload
   */
  payload: {
    /**
     * Add other payloads here as needed.
     *
     * @generated from field: runme.runner.v2.ExecuteRequest execute_request = 1;
     */
    value: ExecuteRequest;
    case: "executeRequest";
  } | { case: undefined; value?: undefined };

  /**
   * Protocol-level ping for frontend heartbeat. Unlike websocket servers which
   * have a spec-integral heartbeat (https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#pings_and_pongs_the_heartbeat_of_websockets),
   * we need to specify our own to cover client->server. The integral heartbeat
   * only works server->client and the browser sandbox is not privy to it.
   * Once the server receives a ping, it will send a pong response with the
   * exact same timestamp.
   *
   * @generated from field: Ping ping = 100;
   */
  ping?: Ping;

  /**
   * Optional authorization header, similar to the HTTP Authorization header.
   *
   * @generated from field: string authorization = 200;
   */
  authorization: string;

  /**
   * Optional Known ID to track the origin cell/block of the request.
   *
   * @generated from field: string known_id = 210;
   */
  knownId: string;

  /**
   * Optional Run ID to track and resume execution.
   *
   * @generated from field: string run_id = 220;
   */
  runId: string;
};

/**
 * SocketRequest defines the message sent by the client over a websocket.
 * The request is a union of types that indicate the type of message.
 *
 * @generated from message SocketRequest
 */
export declare type SocketRequestJson = {
  /**
   * Add other payloads here as needed.
   *
   * @generated from field: runme.runner.v2.ExecuteRequest execute_request = 1;
   */
  executeRequest?: ExecuteRequestJson;

  /**
   * Protocol-level ping for frontend heartbeat. Unlike websocket servers which
   * have a spec-integral heartbeat (https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#pings_and_pongs_the_heartbeat_of_websockets),
   * we need to specify our own to cover client->server. The integral heartbeat
   * only works server->client and the browser sandbox is not privy to it.
   * Once the server receives a ping, it will send a pong response with the
   * exact same timestamp.
   *
   * @generated from field: Ping ping = 100;
   */
  ping?: PingJson;

  /**
   * Optional authorization header, similar to the HTTP Authorization header.
   *
   * @generated from field: string authorization = 200;
   */
  authorization?: string;

  /**
   * Optional Known ID to track the origin cell/block of the request.
   *
   * @generated from field: string known_id = 210;
   */
  knownId?: string;

  /**
   * Optional Run ID to track and resume execution.
   *
   * @generated from field: string run_id = 220;
   */
  runId?: string;
};

/**
 * Describes the message SocketRequest.
 * Use `create(SocketRequestSchema)` to create a new message.
 */
export declare const SocketRequestSchema: GenMessage<SocketRequest, SocketRequestJson>;

/**
 * SocketResponse defines the message sent by the server over a websocket.
 * The response is a union of types that indicate the type of message.
 *
 * @generated from message SocketResponse
 */
export declare type SocketResponse = Message<"SocketResponse"> & {
  /**
   * @generated from oneof SocketResponse.payload
   */
  payload: {
    /**
     * Add other payloads here as needed.
     *
     * @generated from field: runme.runner.v2.ExecuteResponse execute_response = 1;
     */
    value: ExecuteResponse;
    case: "executeResponse";
  } | { case: undefined; value?: undefined };

  /**
   * Protocol-level pong for frontend heartbeat. Once the server receives
   * a ping, it will send a pong response with the exact same timestamp.
   * This allows the frontend (client) to detect if the connection is
   * still alive or stale/inactive. See SocketRequest's ping for more details.
   *
   * @generated from field: Pong pong = 100;
   */
  pong?: Pong;

  /**
   * Optional socket-level status.
   *
   * @generated from field: SocketStatus status = 200;
   */
  status?: SocketStatus;

  /**
   * Optional Known ID to track the origin cell/block of the request.
   *
   * @generated from field: string known_id = 210;
   */
  knownId: string;

  /**
   * Optional Run ID to track and resume execution.
   *
   * @generated from field: string run_id = 220;
   */
  runId: string;
};

/**
 * SocketResponse defines the message sent by the server over a websocket.
 * The response is a union of types that indicate the type of message.
 *
 * @generated from message SocketResponse
 */
export declare type SocketResponseJson = {
  /**
   * Add other payloads here as needed.
   *
   * @generated from field: runme.runner.v2.ExecuteResponse execute_response = 1;
   */
  executeResponse?: ExecuteResponseJson;

  /**
   * Protocol-level pong for frontend heartbeat. Once the server receives
   * a ping, it will send a pong response with the exact same timestamp.
   * This allows the frontend (client) to detect if the connection is
   * still alive or stale/inactive. See SocketRequest's ping for more details.
   *
   * @generated from field: Pong pong = 100;
   */
  pong?: PongJson;

  /**
   * Optional socket-level status.
   *
   * @generated from field: SocketStatus status = 200;
   */
  status?: SocketStatusJson;

  /**
   * Optional Known ID to track the origin cell/block of the request.
   *
   * @generated from field: string known_id = 210;
   */
  knownId?: string;

  /**
   * Optional Run ID to track and resume execution.
   *
   * @generated from field: string run_id = 220;
   */
  runId?: string;
};

/**
 * Describes the message SocketResponse.
 * Use `create(SocketResponseSchema)` to create a new message.
 */
export declare const SocketResponseSchema: GenMessage<SocketResponse, SocketResponseJson>;

