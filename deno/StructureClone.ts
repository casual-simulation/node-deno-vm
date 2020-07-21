import { encode, decode } from 'https://deno.land/std/encoding/base64.ts';

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
 * The returned object contains a root which is the entry point to the data structure and optionally
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
): Structure | StructureWithRefs {
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

export function deserializeStructure(value: Structure | StructureWithRefs) {
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
    const ref = map.get(value);
    if (ref) {
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
        value instanceof Int32Array
    ) {
        let ref = {
            root: encode(
                new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
            ),
            type: value.constructor.name,
        } as Ref;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj: ref,
        });
        return [id];
    } else if (value instanceof ArrayBuffer) {
        let ref = {
            root: encode(new Uint8Array(value)),
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
        const ref = {
            root,
            type: 'BigInt',
        } as const;
        (<any>map)[HAS_CIRCULAR_REF_OR_TRANSFERRABLE] = true;
        map.set(value, {
            id,
            obj: ref,
        });
        return [id];
    } else if (Array.isArray(value)) {
        let root = [] as any[];
        let ref = {
            root,
        } as Ref;
        map.set(value, {
            id,
            obj: ref,
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
    structure: StructureWithRefs,
    ref: string,
    map: Map<string, any>
): any {
    if (map.has(ref)) {
        return map.get(ref);
    }

    const refData = structure.refs[ref];
    if (!refData) {
        throw new Error('Missing reference');
    }

    if ('type' in refData && !!refData.type) {
        const types = [
            'ArrayBuffer',
            'Uint8Array',
            'Uint16Array',
            'Uint32Array',
            'Int8Array',
            'Int16Array',
            'Int32Array',
        ];
        if (types.indexOf(refData.type) >= 0) {
            const bytes = new Uint8Array(decode(refData.root));
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
                const [key, val] = _deserializeRef(structure, value[0], map);
                final.set(key, val);
            }
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
}

export interface StructureWithRefs {
    root: any;
    refs: {
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
        | 'Date'
        | 'RegExp'
        | 'Map';
}
