import { fromByteArray, toByteArray } from 'base64-js';
import { Transferrable } from './MessageTarget';
import { MessagePort, MessageChannel } from './MessageChannel';

const HAS_CIRCULAR_REF_OR_TRANSFERRABLE = Symbol('hasCircularRef');

/**
 * Serializes the given value into a new object that is flat and contains no circular references.
 *
 * The returned object is JSON-safe and contains a root which is the entry point to the data structure and optionally
 * contains a refs property which is a flat map of references.
 *
 * If the refs property is defined, then the data structure was circular.
 *
 * @param value The value to serialize.
 * @param transferrable The transferrable list.
 */
export function serializeStructure(
    value: unknown,
    transferrable?: Transferrable[]
): Structure {
    if (
        (typeof value !== 'object' && typeof value !== 'bigint') ||
        value === null
    ) {
        return {
            root: value,
        };
    } else {
        let map = new Map<any, MapRef>();
        const result = _serializeObject(value, map);

        if ((<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] === true) {
            let refs = {} as any;
            for (let [key, ref] of map) {
                refs[ref.id] = ref.obj;
            }
            return {
                root: result,
                refs: refs,
            };
        }
        return {
            root: value,
        };
    }
}

/**
 * Deserializes the given structure into its original form.
 * @param value The structure to deserialize.
 */
export function deserializeStructure(value: Structure): DeserializedStructure {
    if ('refs' in value) {
        let map = new Map<string, any>();
        let list = [] as Transferrable[];
        const result = _deserializeRef(value, value.root[0], map, list);
        return {
            data: result,
            transferred: list,
        };
    } else {
        return {
            data: value.root,
            transferred: [],
        };
    }
}

function _serializeObject(value: unknown, map: Map<any, MapRef>) {
    if (typeof value !== 'object' && typeof value !== 'bigint') {
        return value;
    }
    if (map.has(value)) {
        const ref = map.get(value);
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        return [ref.id];
    }
    let id = '$' + map.size;

    if (
        value instanceof Uint8Array ||
        value instanceof Uint16Array ||
        value instanceof Uint32Array ||
        value instanceof Int8Array ||
        value instanceof Int16Array ||
        value instanceof Int32Array ||
        value instanceof ArrayBuffer
    ) {
        let ref = {
            root: fromByteArray(
                value instanceof ArrayBuffer
                    ? new Uint8Array(value)
                    : new Uint8Array(
                          value.buffer,
                          value.byteOffset,
                          value.byteLength
                      )
            ),
            type: value.constructor.name,
        } as Ref;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj: ref,
        });
        return [id];
    } else if (typeof value === 'bigint') {
        const root = value.toString();
        const obj = {
            root,
            type: 'BigInt',
        } as const;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj,
        });
        return [id];
    } else if (Array.isArray(value)) {
        let root = [] as any[];
        let obj = {
            root,
        } as Ref;
        map.set(value, {
            id,
            obj,
        });
        for (let prop of value) {
            root.push(_serializeObject(prop, map));
        }
        return [id];
    } else if (value instanceof Date) {
        const obj = {
            root: value.toISOString(),
            type: 'Date',
        } as const;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj,
        });
        return [id];
    } else if (value instanceof RegExp) {
        const obj = {
            root: {
                source: value.source,
                flags: value.flags,
            },
            type: 'RegExp',
        } as const;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj,
        });
        return [id];
    } else if (value instanceof Map) {
        let root = [] as any[];
        let obj = {
            root,
            type: 'Map',
        } as Ref;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj,
        });
        for (let prop of value) {
            root.push(_serializeObject(prop, map));
        }
        return [id];
    } else if (value instanceof Set) {
        let root = [] as any[];
        let obj = {
            root,
            type: 'Set',
        } as Ref;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj,
        });
        for (let prop of value) {
            root.push(_serializeObject(prop, map));
        }
        return [id];
    } else if (value instanceof Error) {
        let obj = {
            root: {
                name: value.name,
                message: value.message,
                stack: value.stack,
            },
            type: 'Error',
        } as const;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj,
        });
        return [id];
    } else if (value instanceof MessagePort) {
        if (!value.transferred) {
            throw new Error(
                'Port must be transferred before serialization. Did you forget to add it to the transfer list?'
            );
        }
        let obj = {
            root: {
                channel: value.channelID,
            },
            type: 'MessagePort',
        } as const;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj,
        });
        return [id];
    } else if (value instanceof Object) {
        let root = {} as any;
        let ref = {
            root,
        } as Ref;
        map.set(value, {
            id,
            obj: ref,
        });
        for (let prop in value) {
            if (Object.hasOwnProperty.call(value, prop)) {
                root[prop] = _serializeObject((<any>value)[prop], map);
            }
        }
        return [id];
    }
}

function _deserializeRef(
    structure: Structure,
    ref: string,
    map: Map<string, any>,
    transfered: Transferrable[]
): any {
    if (map.has(ref)) {
        return map.get(ref);
    }

    const refData = structure.refs[ref];

    if ('type' in refData) {
        const arrayTypes = [
            'ArrayBuffer',
            'Uint8Array',
            'Uint16Array',
            'Uint32Array',
            'Int8Array',
            'Int16Array',
            'Int32Array',
        ];
        if (arrayTypes.indexOf(refData.type) >= 0) {
            const bytes = toByteArray(refData.root);
            const final =
                refData.type == 'Uint8Array'
                    ? bytes
                    : refData.type === 'ArrayBuffer'
                    ? bytes.buffer.slice(
                          bytes.byteOffset,
                          bytes.byteOffset + bytes.byteLength
                      )
                    : refData.type === 'Int8Array'
                    ? new Int8Array(
                          bytes.buffer,
                          bytes.byteOffset,
                          bytes.byteLength / Int8Array.BYTES_PER_ELEMENT
                      )
                    : refData.type == 'Int16Array'
                    ? new Int16Array(
                          bytes.buffer,
                          bytes.byteOffset,
                          bytes.byteLength / Int16Array.BYTES_PER_ELEMENT
                      )
                    : refData.type == 'Int32Array'
                    ? new Int32Array(
                          bytes.buffer,
                          bytes.byteOffset,
                          bytes.byteLength / Int32Array.BYTES_PER_ELEMENT
                      )
                    : refData.type == 'Uint16Array'
                    ? new Uint16Array(
                          bytes.buffer,
                          bytes.byteOffset,
                          bytes.byteLength / Uint16Array.BYTES_PER_ELEMENT
                      )
                    : refData.type == 'Uint32Array'
                    ? new Uint32Array(
                          bytes.buffer,
                          bytes.byteOffset,
                          bytes.byteLength / Uint32Array.BYTES_PER_ELEMENT
                      )
                    : null;
            map.set(ref, final);
            return final;
        } else if (refData.type === 'BigInt') {
            const final = BigInt(refData.root);
            map.set(ref, final);
            return final;
        } else if (refData.type === 'Date') {
            const final = new Date(refData.root);
            map.set(ref, final);
            return final;
        } else if (refData.type === 'RegExp') {
            const final = new RegExp(refData.root.source, refData.root.flags);
            map.set(ref, final);
            return final;
        } else if (refData.type === 'Map') {
            let final = new Map();
            map.set(ref, final);
            for (let value of refData.root) {
                const [key, val] = _deserializeRef(
                    structure,
                    value[0],
                    map,
                    transfered
                );
                final.set(key, val);
            }
            return final;
        } else if (refData.type === 'Set') {
            let final = new Set();
            map.set(ref, final);
            for (let value of refData.root) {
                const val = Array.isArray(value)
                    ? _deserializeRef(structure, value[0], map, transfered)
                    : value;
                final.add(val);
            }
            return final;
        } else if (refData.type === 'Error') {
            let proto = Error.prototype;
            if (refData.root.name === 'EvalError') {
                proto = EvalError.prototype;
            } else if (refData.root.name === 'RangeError') {
                proto = RangeError.prototype;
            } else if (refData.root.name === 'ReferenceError') {
                proto = ReferenceError.prototype;
            } else if (refData.root.name === 'SyntaxError') {
                proto = SyntaxError.prototype;
            } else if (refData.root.name === 'TypeError') {
                proto = TypeError.prototype;
            } else if (refData.root.name === 'URIError') {
                proto = URIError.prototype;
            }
            let final = Object.create(proto);
            if (typeof refData.root.message !== 'undefined') {
                Object.defineProperty(final, 'message', {
                    value: refData.root.message,
                    writable: true,
                    enumerable: false,
                    configurable: true,
                });
            }
            if (typeof refData.root.stack !== 'undefined') {
                Object.defineProperty(final, 'stack', {
                    value: refData.root.stack,
                    writable: true,
                    enumerable: false,
                    configurable: true,
                });
            }
            return final;
        } else if (refData.type === 'MessagePort') {
            const channel = new MessageChannel(refData.root.channel);
            map.set(ref, channel.port1);
            transfered.push(channel.port2);
            return channel.port1;
        }
    } else if (Array.isArray(refData.root)) {
        let arr = [] as any[];
        map.set(ref, arr);
        for (let value of refData.root) {
            arr.push(
                Array.isArray(value)
                    ? _deserializeRef(structure, value[0], map, transfered)
                    : value
            );
        }
        return arr;
    } else if (typeof refData.root === 'object') {
        let obj = {} as any;
        map.set(ref, obj);
        for (let prop in refData.root) {
            if (Object.hasOwnProperty.call(refData.root, prop)) {
                const value = refData.root[prop];
                obj[prop] = Array.isArray(value)
                    ? _deserializeRef(structure, value[0], map, transfered)
                    : value;
            }
        }
        return obj;
    }

    map.set(ref, refData.root);
    return refData.root;
}

/**
 * Defines an interface for a serializable structure.
 * Usually created from a normal JavaScript object.
 */
export interface Structure {
    /**
     * The entry point into the structure.
     * Can be a reference to an object in the refs property.
     */
    root: any;

    /**
     * The ID of the channel that serialized this structure.
     * If omitted, then the root channel sent this message.
     * Used to multiplex messages.
     */
    channel?: number | string;

    /**
     * A map of reference IDs to objects.
     * Objects can additionally reference other objects.
     */
    refs?: {
        [key: string]: Ref;
    };
}

/**
 * Defines an interface for a structure that was deserialized.
 */
export interface DeserializedStructure {
    /**
     * The data in the structure.
     */
    data: any;

    /**
     * The list of values that were transferred and require extra processing to be fully transferred.
     */
    transferred: Transferrable[];
}

interface MapRef {
    id: string;
    obj: Ref;
}

/**
 * Defines an interface for an object that has been serialized into a flat structure with references to other objects.
 */
export interface Ref {
    /**
     * The entry point for the object.
     * Can contain references to other objects.
     */
    root: any;

    /**
     * The type of the reference.
     * If omitted, then the value is either an object or an array.
     * If specified, then the value should be converted into the given type on
     * deserialization.
     */
    type?:
        | 'ArrayBuffer'
        | 'Uint8Array'
        | 'Uint16Array'
        | 'Uint32Array'
        | 'Int8Array'
        | 'Int16Array'
        | 'Int32Array'
        | 'BigInt'
        | 'Date'
        | 'RegExp'
        | 'Map'
        | 'Set'
        | 'Error'
        | 'MessagePort';
}
