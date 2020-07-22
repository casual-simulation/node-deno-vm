import {
    MessagePortInterface,
    Transferrable,
    MessageEvent,
    OnMessageListener,
} from './MessageTarget.ts';

// Global Channel ID counter.
let channelIDCounter = 0;

/**
 * Defines a class that implements the Channel Messaging API for the worker.
 */
export class MessageChannel {
    port1: MessagePort;
    port2: MessagePort;

    constructor(channel?: number) {
        const id = typeof channel === 'number' ? channel : channelIDCounter++;
        this.port1 = new MessagePort(id);
        this.port2 = new MessagePort(id);
        MessagePort.link(this.port1, this.port2);
    }
}

/**
 * Defines a class that allows messages sent from one port to be recieved at the other port.
 */
export class MessagePort implements MessagePortInterface {
    /**
     * Whether this message port has been transferred.
     */
    private _transferred: boolean;

    /**
     * The function that should be called to send a message to the remote.
     */
    private _sendMessage: (data: any, transfer?: Transferrable[]) => void;

    /**
     * The ID of this message port's channel.
     */
    private _channelId: number;

    /**
     * The "message" listeners.
     */
    private _listeners: OnMessageListener[];

    /**
     * The other message port.
     */
    private _other: MessagePort | null;

    get channelID() {
        return this._channelId;
    }

    get transferred() {
        return this._transferred;
    }

    constructor(channelID: number) {
        this._other = null;
        this._transferred = false;
        this._channelId = channelID;
        this._listeners = [];
        this._sendMessage = () => {};
        this.onmessage = () => {};
    }

    addEventListener(type: 'message', listener: OnMessageListener): void {
        if (type === 'message') {
            this._listeners.push(listener);
        }
    }

    removeEventListener(type: 'message', listener: OnMessageListener): void {
        if (type === 'message') {
            const index = this._listeners.indexOf(listener);
            if (index >= 0) {
                this._listeners.splice(index, 1);
            }
        }
    }

    postMessage(data: any, transferrable?: Transferrable[]) {
        if (this.transferred) {
            this._sendMessage(data, transferrable);
        } else {
            if (this._other) {
                this._other._recieveMessage(data);
            }
        }
    }

    start() {}

    close() {}

    /**
     * Represents an event handler for the "message" event, that is a function to be called when a message is recieved from the worker.
     */
    onmessage: (e: MessageEvent) => void;

    transfer(
        sendMessage: (data: any, transfer?: Transferrable[]) => void
    ): (data: any) => void {
        if (this.transferred) {
            throw new Error('Already transferred');
        }
        if (!this._other) {
            throw new Error('Must be linked to another message port.');
        }

        this._transferred = true;
        this._other._transferred = true;
        this._other._sendMessage = sendMessage;
        return this._other._recieveMessage.bind(this._other);
    }

    private _recieveMessage(data: any) {
        const event = {
            data,
        } as MessageEvent;
        if (this.onmessage) {
            this.onmessage(event);
        }
        for (let onmessage of this._listeners) {
            onmessage(event);
        }
    }

    /**
     * Links the two message ports.
     * @param port1 The first port.
     * @param port2 The second port.
     */
    static link(port1: MessagePort, port2: MessagePort) {
        port1._other = port2;
        port2._other = port1;
    }
}
