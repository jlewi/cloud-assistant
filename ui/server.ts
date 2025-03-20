import fs from "node:fs";
import { createServer } from "node:http";
import tls from "node:tls";
import next from "next";
import { Server, Socket } from "socket.io";
import { Client, createClient } from "@connectrpc/connect";
import {
  createGrpcTransport,
  ConnectTransportOptions,
} from "@connectrpc/connect-node";
import {
  createWritableIterable,
  WritableIterable,
} from "@connectrpc/connect/protocol";
import {
  RunnerService,
  ExecuteRequest,
  ExecuteResponse,
  ExecuteResponseSchema,
  ExecuteRequestSchema,
} from "@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb.js";
import {
  fromJson,
  fromJsonString,
  JsonValue,
  toJson,
} from "@bufbuild/protobuf";

type RunnerClient = Client<typeof RunnerService>;

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const client = createRunnerClient();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);

  io.on("connection", async (socket) => {
    new RunnerSession(client, socket);
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});

function createRunnerClient() {
  const transportOptions: ConnectTransportOptions = {
    baseUrl: "https://127.0.0.1:9888",
    httpVersion: "2",
  };

  const nodeSecureContextOptions: tls.SecureContextOptions = {
    key: fs.readFileSync("/tmp/assistants/runme/tls/key.pem"),
    cert: fs.readFileSync("/tmp/assistants/runme/tls/cert.pem"),
    ca: fs.readFileSync("/tmp/assistants/runme/tls/cert.pem"),
  };

  transportOptions.nodeOptions = {
    ...transportOptions.nodeOptions,
    ...nodeSecureContextOptions,
  };

  const transport = createGrpcTransport(transportOptions);
  const client: RunnerClient = createClient(RunnerService, transport);

  return client;
}

class RunnerSession {
  private requests: WritableIterable<ExecuteRequest> | undefined;

  constructor(
    private readonly client: RunnerClient,
    private readonly socket: Socket
  ) {
    this.socket.on(
      ExecuteRequestSchema.typeName,
      async (req: ExecuteRequest) => {
        return this.send(req);
      }
    );
  }

  async send(request: ExecuteRequest | JsonValue | string) {
    if (!this.requests) {
      this.requests = createWritableIterable<ExecuteRequest>();
      this.execute();
    }

    if (typeof request === "object" && !("$typeName" in request)) {
      request = fromJson(ExecuteRequestSchema, request as JsonValue);
    }

    if (typeof request === "string") {
      request = fromJsonString(ExecuteRequestSchema, request);
    }

    this.requests.write(request as ExecuteRequest);
  }

  async close() {
    this.requests.close();
    this.requests = undefined;
  }

  async execute(): Promise<void> {
    try {
      const session = this.client.execute(this.requests);
      for await (const response of session) {
        // console.log("ExecuteResponse", response);
        const encodedJson = toJson(ExecuteResponseSchema, response);
        this.socket.emit(ExecuteResponseSchema.typeName, encodedJson);
        if (Number.isFinite(response.exitCode)) {
          this.close();
        }
      }
    } catch (error) {
      console.error("Error executing request:", error);
      this.close();
    }
  }
}
