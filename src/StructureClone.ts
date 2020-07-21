import { fromByteArray, toByteArray } from 'base64-js';

const HAS_CIRCULAR_REF_OR_TRANSFERRABLE = Symbol('hasCircularRef');

export type Transferrable =
    | ArrayBuffer
    | Uint8Array
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array;

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
export function deserializeStructure(value: Structure) {
    if ('refs' in value) {
        let map = new Map<string, any>();
        const result = _deserializeRef(value, value.root[0], map);
        return result;
    } else {
        return value.root;
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
            if (value.hasOwnProperty(prop)) {
                root[prop] = _serializeObject((<any>value)[prop], map);
            }
        }
        return [id];
    }
}

function _deserializeRef(
    structure: Structure,
    ref: string,
    map: Map<string, any>
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
        }
    } else if (Array.isArray(refData.root)) {
        let arr = [] as any[];
        map.set(ref, arr);
        for (let value of refData.root) {
            arr.push(
                Array.isArray(value)
                    ? _deserializeRef(structure, value[0], map)
                    : value
            );
        }
        return arr;
    } else if (typeof refData.root === 'object') {
        let obj = {} as any;
        map.set(ref, obj);
        for (let prop in refData.root) {
            if (refData.root.hasOwnProperty(prop)) {
                const value = refData.root[prop];
                obj[prop] = Array.isArray(value)
                    ? _deserializeRef(structure, value[0], map)
                    : value;
            }
        }
        return obj;
    }

    map.set(ref, refData.root);
    return refData.root;
}

export interface Structure {
    root: any;
    refs?: {
        [key: string]: Ref;
    };
}

interface MapRef {
    id: string;
    obj: Ref;
}

export interface Ref {
    root: any;
    type?:
        | 'ArrayBuffer'
        | 'Uint8Array'
        | 'Uint16Array'
        | 'Uint32Array'
        | 'Int8Array'
        | 'Int16Array'
        | 'Int32Array'
        | 'BigInt'
        | 'Date';
}
