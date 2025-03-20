"use client";

import "./runme-vscode.css";
import "./renderers/client";
import { setContext, ClientMessages } from "./renderers/client";
import { RendererContext } from "vscode-notebook-renderer";
import { ExecuteResponse, ExecuteResponseSchema } from "@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb";
import { fromJson, toJson } from "@bufbuild/protobuf";
import io, { Socket } from 'socket.io-client'
import { useEffect } from "react";
import { ExecuteRequest, ExecuteRequestSchema } from "@buf/stateful_runme.bufbuild_es/runme/runner/v2/runner_pb";
import { create } from "@bufbuild/protobuf";
import { VSCodeEvent } from "vscode-notebook-renderer/events";
import { ulid } from "ulid";

let socket: Socket;

function buildExecuteRequest(): ExecuteRequest {
    const blockID = ulid();
    return create(ExecuteRequestSchema, {
        storeStdoutInEnv: true,
        config: {
            programName: "/bin/zsh",
            arguments: [],
            // directory:
            //     "/Users/sourishkrout/Projects/stateful/oss/vscode-runme/examples",
            languageId: "sh",
            background: false,
            fileExtension: "",
            env: [
                `RUNME_ID=${blockID}`,
                "RUNME_RUNNER=v2",
                "TERM=xterm-256color",
            ],
            source: {
                case: "commands",
                value: {
                    items: [
                        // 'for i in {1..10}; do',
                        // '  echo "Value: $i"',
                        // '  sleep 1',
                        // 'done',
                        // 'runme',
                        'ls -la'
                    ],
                },
            },
            interactive: true,
            mode: 1,
            knownId: blockID,
            // knownName: "for-i",
        },
        winsize: { rows: 34, cols: 100, x: 0, y: 0 },
    });
}

const RunmeConsole = ({
    commands,
    rows = 20,
    onStdout,
    onStderr,
    onExitCode
}: {
    commands: string[],
    rows?: number,
    onStdout?: (data: Uint8Array) => void,
    onStderr?: (data: Uint8Array) => void,
    onExitCode?: (code: number) => void
}) => {
    const execReq = buildExecuteRequest();
    const defaults = {
        output: {
            'runme.dev/id': execReq.config.knownId,
            fontFamily: 'monospace',
            fontSize: 12,
            cursorStyle: 'block',
            cursorBlink: true,
            cursorWidth: 1,
            smoothScrollDuration: 100,
            scrollback: 1000,
            initialRows: rows,
            content: '',
            isAutoSaveEnabled: false,
            isPlatformAuthEnabled: false,
        }
    }

    const encoder = new TextEncoder();
    let callback: VSCodeEvent<any> | undefined;

    setContext({
        postMessage: (message: unknown) => {
            if ((message as any).type === ClientMessages.terminalOpen) {
                const columns = Number((message as any).output.terminalDimensions.columns);
                const rows = Number((message as any).output.terminalDimensions.rows);
                if (Number.isFinite(columns) && Number.isFinite(rows)) {
                    execReq.winsize.cols = columns;
                    execReq.winsize.rows = rows;
                }
            }
            if ((message as any).type === ClientMessages.terminalStdin) {
                const inputData = encoder.encode((message as any).output.input);
                const req = toJson(ExecuteRequestSchema, create(ExecuteRequestSchema, { inputData }));
                console.log("terminalStdin", req);
                socket.emit(ExecuteRequestSchema.typeName, req);
            }
        },
        onDidReceiveMessage: (listener: VSCodeEvent<any>) => {
            callback = listener;
        }
    } as Partial<RendererContext<void>>)

    useEffect(() => {
        socket = io( {
            transports: ['websocket']
          });

        socket.on('connect', () => {
            console.log(new Date(), 'Connected to WebSocket server');
        });

        socket.on(ExecuteResponseSchema.typeName, (r: string) => {
            const response = fromJson(ExecuteResponseSchema, r);
            if (response.stdoutData) {
                callback?.({
                    type: ClientMessages.terminalStdout,
                    output: {
                        'runme.dev/id': execReq.config.knownId,
                        data: response.stdoutData,
                    },
                } as any);

                if (onStdout) {
                    onStdout(response.stdoutData);
                }
            }
            if (response.stderrData) {
                callback?.({
                    type: ClientMessages.terminalStderr,
                    output: {
                        'runme.dev/id': execReq.config.knownId,
                        data: response.stderrData,
                    },
                } as any);

                if (onStderr) {
                    onStderr(response.stderrData);
                }
            }

            if (response.exitCode !== undefined) {
                if (onExitCode) {
                    onExitCode(response.exitCode);
                }
            }
        });

        return () => {
            console.log(new Date(), 'Disconnected from WebSocket server');
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (execReq.config.source.case === "commands") {
            execReq.config.source.value.items = commands;
        }
        socket.emit(ExecuteRequestSchema.typeName, execReq);
    }, [commands]);

    return (<div
        ref={(el) => {
            if (!el || el.hasChildNodes()) { return };
            const terminalElem = document.createElement('terminal-view');
            terminalElem.setAttribute('buttons', 'false')

            terminalElem.setAttribute('id', defaults.output['runme.dev/id'])
            terminalElem.setAttribute('fontFamily', defaults.output.fontFamily)
            if (typeof defaults.output.fontSize === 'number') {
                terminalElem.setAttribute('fontSize', defaults.output.fontSize.toString())
            }
            if (defaults.output.cursorStyle) {
                terminalElem.setAttribute('cursorStyle', defaults.output.cursorStyle)
            }
            if (typeof defaults.output.cursorBlink === 'boolean') {
                terminalElem.setAttribute(
                    'cursorBlink',
                    defaults.output.cursorBlink ? 'true' : 'false',
                )
            }
            if (typeof defaults.output.cursorWidth === 'number') {
                terminalElem.setAttribute('cursorWidth', defaults.output.cursorWidth.toString())
            }
            if (typeof defaults.output.smoothScrollDuration === 'number') {
                terminalElem.setAttribute(
                    'smoothScrollDuration',
                    defaults.output.smoothScrollDuration.toString(),
                )
            }
            if (typeof defaults.output.scrollback === 'number') {
                terminalElem.setAttribute('scrollback', defaults.output.scrollback.toString())
            }
            if (defaults.output.initialRows !== undefined) {
                terminalElem.setAttribute('initialRows', defaults.output.initialRows.toString())
            }

            if (defaults.output.content !== undefined) {
                terminalElem.setAttribute('initialContent', defaults.output.content)
            }

            if (defaults.output.isAutoSaveEnabled) {
                terminalElem.setAttribute(
                    'isAutoSaveEnabled',
                    defaults.output.isAutoSaveEnabled.toString(),
                )
            }

            if (defaults.output.isPlatformAuthEnabled) {
                terminalElem.setAttribute(
                    'isPlatformAuthEnabled',
                    defaults.output.isPlatformAuthEnabled.toString(),
                )
            }

            el.appendChild(terminalElem);
        }}
    ></div>)
}

export default RunmeConsole;

