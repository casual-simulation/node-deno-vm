import { createServer, Server } from 'http';
import WebSocket, { Server as WSServer } from 'ws';
import { resolve } from 'path';
import { ChildProcess, spawn } from 'child_process';
import {
    serializeStructure,
    deserializeStructure,
    Structure,
} from './StructureClone';
import { URL } from 'url';
import process from 'process';
import {
    OnMessageListener,
    MessageEvent,
    Transferrable,
} from './MessageTarget';
import { MessagePort } from './MessageChannel';

const DEFAULT_DENO_BOOTSTRAP_SCRIPT_PATH = __dirname.endsWith('src')
    ? resolve(__dirname, '../deno/index.ts')
    : resolve(__dirname, '../../deno/index.ts');

export interface DenoWorkerOptions {
    /**
     * The path to the executable that should be use when spawning the subprocess.
     * Defaults to "deno".
     */
    denoExecutable: string;

    /**
     * The path to the script that should be used to bootstrap the worker environment in Deno.
     * If specified, this script will be used instead of the default bootstrap script.
     * Only advanced users should set this.
     */
    denoBootstrapScriptPath: string;

    /**
     * Whether to reload scripts.
     * If given a list of strings then only the specified URLs will be reloaded.
     * Defaults to false when NODE_ENV is set to "production" and true otherwise.
     */
    reload: boolean | string[];

    /**
     * The permissions that the Deno worker should use.
     */
    permissions: {
        /**
         * Whether to allow all permissions.
         * Defaults to false.
         */
        allowAll?: boolean;

        /**
         * Whether to allow network connnections.
         * If given a list of strings then only the specified origins/paths are allowed.
         * Defaults to false.
         */
        allowNet?: boolean | string[];

        /**
         * Whether to allow reading from the filesystem.
         * If given a list of strings then only the specified file paths are allowed.
         * Defaults to false.
         */
        allowRead?: boolean | string[];

        /**
         * Whether to allow writing to the filesystem.
         * If given a list of strings then only the specified file paths are allowed.
         * Defaults to false.
         */
        allowWrite?: boolean | string[];

        /**
         * Whether to allow reading environment variables.
         * Defaults to false.
         */
        allowEnv?: boolean;

        /**
         * Whether to allow running Deno plugins.
         * Defaults to false.
         */
        allowPlugin?: boolean;

        /**
         * Whether to allow running subprocesses.
         * Defaults to false.
         */
        allowRun?: boolean;

        /**
         * Whether to allow high resolution time measurement.
         * Defaults to false.
         */
        allowHrtime?: boolean;
    };
}

/**
 * The DenoWorker class is a WebWorker-like interface for interacting with Deno.
 *
 * Because Deno is an isolated environment, this worker gives you the ability to run untrusted JavaScript code without
 * potentially compromising your system.
 */
export class DenoWorker {
    private _httpServer: Server;
    private _server: WSServer;
    private _process: ChildProcess;
    private _socket: WebSocket;
    private _onmessageListeners: OnMessageListener[];
    private _available: boolean;
    private _pendingMessages: string[];
    private _options: DenoWorkerOptions;
    private _ports: Map<number, MessagePortData>;
    private _terminated: boolean;

    /**
     * Creates a new DenoWorker instance and injects the given script.
     * @param script The JavaScript that the worker should be started with.
     */
    constructor(script: string | URL, options?: Partial<DenoWorkerOptions>) {
        this._onmessageListeners = [];
        this._pendingMessages = [];
        this._available = false;
        this._options = Object.assign(
            {
                denoExecutable: 'deno',
                denoBootstrapScriptPath: DEFAULT_DENO_BOOTSTRAP_SCRIPT_PATH,
                reload: process.env.NODE_ENV !== 'production',
                permissions: {},
            },
            options || {}
        );
        this._ports = new Map();
        this._httpServer = createServer();
        this._server = new WSServer({
            server: this._httpServer,
        });
        this._server.on('connection', (socket) => {
            if (this._socket) {
                socket.close();
                return;
            }
            this._socket = socket;
            socket.on('message', (message) => {
                if (typeof message === 'string') {
                    const structuredData = JSON.parse(message) as Structure;
                    const channel = structuredData.channel;
                    const deserialized = deserializeStructure(structuredData);
                    const data = deserialized.data;

                    if (deserialized.transferred) {
                        this._handleTransferrables(deserialized.transferred);
                    }

                    if (!this._available && data && data.type === 'init') {
                        this._available = true;
                        let pendingMessages = this._pendingMessages;
                        this._pendingMessages = [];
                        for (let message of pendingMessages) {
                            socket.send(message);
                        }
                    } else {
                        if (typeof channel === 'number') {
                            const portData = this._ports.get(channel);
                            if (portData) {
                                portData.recieveData(data);
                            }
                        } else {
                            const event = {
                                data,
                            } as MessageEvent;
                            if (this.onmessage) {
                                this.onmessage(event);
                            }
                            for (let onmessage of this._onmessageListeners) {
                                onmessage(event);
                            }
                        }
                    }
                }
            });

            socket.on('close', () => {
                this._available = false;
                this._socket = null;
            });
        });

        this._httpServer.listen({ host: '127.0.0.1', port: 0 }, () => {
            if (this._terminated) {
                return;
            }
            const addr = this._httpServer.address();
            let connectAddress: string;
            let allowAddress: string;
            if (typeof addr === 'string') {
                connectAddress = addr;
            } else {
                connectAddress = `http://${addr.address}:${addr.port}`;
                allowAddress = `${addr.address}:${addr.port}`;
            }

            let scriptArgs: string[];

            if (typeof script === 'string') {
                scriptArgs = ['script', script];
            } else {
                scriptArgs = ['import', script.href];
            }

            let runArgs = [] as string[];

            addOption(runArgs, '--reload', this._options.reload);

            runArgs.push(`--allow-net=${allowAddress}`);

            if (this._options.permissions) {
                addOption(
                    runArgs,
                    '--allow-all',
                    this._options.permissions.allowAll
                );
                addOption(
                    runArgs,
                    '--allow-net',
                    this._options.permissions.allowNet
                );
                addOption(
                    runArgs,
                    '--allow-read',
                    this._options.permissions.allowRead
                );
                addOption(
                    runArgs,
                    '--allow-write',
                    this._options.permissions.allowWrite
                );
                addOption(
                    runArgs,
                    '--allow-env',
                    this._options.permissions.allowEnv
                );
                addOption(
                    runArgs,
                    '--allow-plugin',
                    this._options.permissions.allowPlugin
                );
                addOption(
                    runArgs,
                    '--allow-hrtime',
                    this._options.permissions.allowHrtime
                );
            }

            this._process = spawn(this._options.denoExecutable, [
                'run',
                ...runArgs,
                this._options.denoBootstrapScriptPath,
                connectAddress,
                ...scriptArgs,
            ]);

            this._process.stdout.setEncoding('utf8');
            this._process.stderr.setEncoding('utf8');
            this._process.stdout.on('data', (data) => {
                console.log('[deno]', data);
            });
            this._process.stderr.on('data', (data) => {
                console.log('[deno]', data);
            });
        });
    }

    /**
     * Represents an event handler for the "message" event, that is a function to be called when a message is recieved from the worker.
     */
    onmessage: (e: MessageEvent) => void = null;

    /**
     * Sends a message to the worker.
     * @param data The data to be sent. Copied via the Structured Clone algorithm so circular references are supported in addition to typed arrays.
     * @param transfer Values that should be transferred. This should include any typed arrays that are referenced in the data.
     */
    postMessage(data: any, transfer?: Transferrable[]): void {
        return this._postMessage(null, data, transfer);
    }

    /**
     * Terminiates the worker and cleans up unused resources.
     */
    terminate() {
        this._terminated = true;
        if (this._process) {
            this._process.kill();
            this._process = null;
        }
        if (this._httpServer) {
            this._httpServer.close();
            this._httpServer = null;
        }
        if (this._server) {
            this._server.close();
            this._server = null;
        }
        this._socket = null;
        this._pendingMessages = null;
    }

    /**
     * Adds the given listener for the "message" event.
     * @param type The type of the event. (Always "message")
     * @param listener The listener to add for the event.
     */
    addEventListener(type: 'message', listener: OnMessageListener): void {
        if (type === 'message') {
            this._onmessageListeners.push(listener);
        }
    }

    /**
     * Removes the given listener for the "message" event.
     * @param type The type of the event. (Always "message")
     * @param listener The listener to add for the event.
     */
    removeEventListener(type: 'message', listener: OnMessageListener): void {
        if (type === 'message') {
            const index = this._onmessageListeners.indexOf(listener);
            if (index >= 0) {
                this._onmessageListeners.splice(index, 1);
            }
        }
    }

    private _postMessage(
        channel: number | null,
        data: any,
        transfer?: Transferrable[]
    ) {
        this._handleTransferrables(transfer);
        const structuredData = serializeStructure(data, transfer);
        if (channel !== null) {
            structuredData.channel = channel;
        }
        const json = JSON.stringify(structuredData);
        if (!this._available) {
            this._pendingMessages.push(json);
        } else if (this._socket) {
            this._socket.send(json);
        }
    }

    private _handleTransferrables(transfer?: Transferrable[]) {
        if (transfer) {
            for (let t of transfer) {
                if (t instanceof MessagePort) {
                    if (!t.transferred) {
                        const channelID = t.channelID;
                        this._ports.set(t.channelID, {
                            port: t,
                            recieveData: t.transfer((data, transfer) => {
                                this._postMessage(channelID, data, transfer);
                            }),
                        });
                    }
                }
            }
        }
    }
}

function addOption(list: string[], name: string, option: boolean | string[]) {
    if (option === true) {
        list.push(`${name}`);
    } else if (Array.isArray(option)) {
        for (let script of option) {
            list.push(`${name}=${script}`);
        }
    }
}

interface MessagePortData {
    port: MessagePort;
    recieveData: (data: any) => void;
}
