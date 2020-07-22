/**
 * The possible transferrable data types.
 */
export type Transferrable =
    | ArrayBuffer
    | Uint8Array
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | MessagePortInterface;

/**
 * Defines an interface for objects that are message ports.
 */
export interface MessagePortInterface extends MessageTarget {
    start(): void;
    close(): void;
}

/**
 * Defines an interface for objects that are able to send and recieve message events.
 */
export interface MessageTarget {
    postMessage(data: any, transferrable?: Transferrable[]): void;
    onmessage(e: MessageEvent): void;

    /**
     * Adds the given listener for the "message" event.
     * @param type The type of the event. (Always "message")
     * @param listener The listener to add for the event.
     */
    addEventListener(type: 'message', listener: OnMessageListener): void;

    /**
     * Removes the given listener for the "message" event.
     * @param type The type of the event. (Always "message")
     * @param listener The listener to add for the event.
     */
    removeEventListener(type: 'message', listener: OnMessageListener): void;
}

export interface OnMessageListener {
    (event: MessageEvent): void;
}

export interface MessageEvent {
    data: any;
}
