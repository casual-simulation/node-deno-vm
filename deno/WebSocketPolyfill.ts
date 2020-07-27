import {
    connectWebSocket,
    WebSocket as WebSocketInterface,
    WebSocketCloseEvent,
    isWebSocketCloseEvent,
    isWebSocketPingEvent,
    isWebSocketPongEvent,
} from 'https://deno.land/std/ws/mod.ts';
import { OnMessageListener, MessageEvent } from './MessageTarget.ts';

enum ReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}

class WebSocketImpl extends EventTarget {
    private _connectionPromise: Promise<WebSocketInterface>;
    private _readyState = ReadyState.CONNECTING;
    private _url: string;
    private _socket: WebSocketInterface | null;

    constructor(url: string) {
        super();
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;
        this.onopen = null;
        this._socket = null;
        this._url = url;
        this._connectionPromise = connectWebSocket(url);
        this._connectionPromise.catch((err) => {
            this._sendOnError(new ErrorEvent(err));
        });

        this._connectionPromise.then(async (socket) => {
            this._socket = socket;
            this._sendOnOpen(new Event('open'));
            for await (const msg of socket) {
                if (isWebSocketCloseEvent(msg)) {
                    this._sendOnClose(new CloseEvent(msg.code, msg.reason));
                } else {
                    this._sendOnMessage(
                        new MessageEvent('message', {
                            data: msg,
                        })
                    );
                }
            }

            if (!socket.isClosed) {
                await socket.close(1000);
                this._sendOnClose(new CloseEvent(1000));
            }
        });
    }

    get url() {
        return this._url;
    }

    get binaryType() {
        return 'arraybuffer';
    }

    set binaryType(value: any) {}

    get bufferedAmount() {
        return 0;
    }

    get extensions() {
        return '';
    }

    get readyState() {
        return this._readyState;
    }

    close(code?: number, reason?: string) {
        if (
            this._readyState !== ReadyState.CLOSING &&
            this._readyState !== ReadyState.CLOSED
        ) {
            this._readyState = ReadyState.CLOSING;
            this._connectionPromise.then((socket) => {
                if (typeof code === 'number' && typeof reason === 'string') {
                    socket.close(code, reason);
                } else if (typeof code === 'number') {
                    socket.close(code);
                } else {
                    socket.close();
                }
            });
        }
    }

    send(data: string | Uint8Array) {
        if (this._readyState !== ReadyState.OPEN) {
            throw new DOMException(
                'readyState must be OPEN.',
                'InvalidStateException'
            );
        }
        this._socket?.send(data);
    }

    onclose: OnCloseHandler | null;
    onmessage: OnMessageListener | null;
    onerror: OnErrorHandler | null;
    onopen: OnOpenHandler | null;

    private _sendOnClose(event: CloseEvent) {
        this._readyState = ReadyState.CLOSED;
        this.dispatchEvent(event);
    }

    private _sendOnMessage(event: MessageEvent) {
        this.dispatchEvent(event);
    }

    private _sendOnError(event: ErrorEvent) {
        this._readyState = ReadyState.CLOSED;
        this.dispatchEvent(event);
    }

    private _sendOnOpen(event: Event) {
        this._readyState = ReadyState.OPEN;
        this.dispatchEvent(event);
    }
}

interface OnCloseHandler {
    (event: CloseEvent): void;
}

interface OnErrorHandler {
    (event: ErrorEvent): void;
}

interface OnOpenHandler {
    (event: Event): void;
}

class CloseEvent extends Event {
    code: number;
    reason: string | null;
    constructor(code: number, reason?: string) {
        super('close');
        this.code = code;
        this.reason = reason || null;
    }
}

class ErrorEvent extends Event {
    error: any;
    constructor(error: any) {
        super('error');
        this.error = error;
    }
}

if (typeof (<any>globalThis).WebSocket === 'undefined') {
    console.log('[WebSocketPolyfill] Polyfilling global WebSocket');
    (<any>globalThis).WebSocket = WebSocketImpl;
}
