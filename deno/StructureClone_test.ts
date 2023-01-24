import {
    assertEquals,
    assert,
    assertThrows,
} from 'https://deno.land/std/testing/asserts.ts';
import { serializeStructure, deserializeStructure } from './StructureClone.ts';
import { MessagePort } from './MessageChannel.ts';

const primitives = [[true], [false], [0], [1], ['string'], [undefined], [null]];

const arrayTypes = [
    ['Uint8Array'] as const,
    ['Uint16Array'] as const,
    ['Uint32Array'] as const,
    ['Int8Array'] as const,
    ['Int16Array'] as const,
    ['Int32Array'] as const,
];

const errorCases = [
    [Error],
    [EvalError],
    [RangeError],
    [ReferenceError],
    [SyntaxError],
    [TypeError],
    [URIError],
];

Deno.test('serializeStructure() should return an object with root', () => {
    for (let [value] of primitives) {
        assertEquals(serializeStructure(value), {
            root: value,
        });
    }
});

Deno.test(
    'serializeStructure() should serialize non-circular objects normally',
    () => {
        let obj1 = {
            name: 'obj1',
            obj2: {
                name: 'obj2',
                obj3: {
                    name: 'obj3',
                },
            },
        };

        assertEquals(serializeStructure(obj1), {
            root: {
                name: 'obj1',
                obj2: {
                    name: 'obj2',
                    obj3: {
                        name: 'obj3',
                    },
                },
            },
        });
    }
);

Deno.test(
    'serializeStructure() should add circular references to the refs map',
    () => {
        let obj3 = {
            name: 'obj3',
        } as any;
        let obj2 = {
            name: 'obj2',
            obj3: obj3,
        } as any;
        let obj1 = {
            name: 'obj1',
            obj2: obj2,
        } as any;

        obj3.obj1 = obj1;

        assertEquals(serializeStructure(obj1), {
            root: ['$0'],
            refs: {
                $0: {
                    root: {
                        name: 'obj1',
                        obj2: ['$1'],
                    },
                },
                $1: {
                    root: {
                        name: 'obj2',
                        obj3: ['$2'],
                    },
                },
                $2: {
                    root: {
                        name: 'obj3',
                        obj1: ['$0'],
                    },
                },
            },
        });
    }
);

Deno.test('serializeStructure() should handle simple arrays', () => {
    assertEquals(serializeStructure(['abc', 'def', 123, true]), {
        root: ['abc', 'def', 123, true],
    });
});

Deno.test('serializeStructure() should handle arrays with objects', () => {
    assertEquals(
        serializeStructure(['abc', 'def', 123, true, { message: 'Hello' }]),
        {
            root: ['abc', 'def', 123, true, { message: 'Hello' }],
        }
    );
});

Deno.test('serializeStructure() should handle circular arrays', () => {
    let arr3 = ['arr3'] as any[];
    let arr2 = ['arr2', arr3];
    let arr1 = ['arr1', arr2];
    arr3.push(arr1);

    assertEquals(serializeStructure(arr1), {
        root: ['$0'],
        refs: {
            $0: {
                root: ['arr1', ['$1']],
            },
            $1: {
                root: ['arr2', ['$2']],
            },
            $2: {
                root: ['arr3', ['$0']],
            },
        },
    });
});

Deno.test(
    'serializeStructure() should map transferrables as special references',
    () => {
        let buffer = new ArrayBuffer(64);
        let obj1 = {
            name: 'obj1',
            buffer: buffer,
        };

        assertEquals(serializeStructure(obj1, [buffer]), {
            root: ['$0'],
            refs: {
                $0: {
                    root: {
                        name: 'obj1',
                        buffer: ['$1'],
                    },
                },
                $1: {
                    root:
                        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
                    type: 'ArrayBuffer',
                },
            },
        });
    }
);

Deno.test(
    'serializeStructure() should map typed arrays as special references',
    () => {
        for (let [type] of arrayTypes) {
            let buffer = new ArrayBuffer(64);
            let array = new (<any>globalThis)[type](buffer);
            let obj1 = {
                name: 'obj1',
                array: array,
            };

            assertEquals(serializeStructure(obj1, [buffer]), {
                root: ['$0'],
                refs: {
                    $0: {
                        root: {
                            name: 'obj1',
                            array: ['$1'],
                        },
                    },
                    $1: {
                        root:
                            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
                        type: type,
                    },
                },
            });
        }
    }
);

Deno.test('serializeStructure() should support BigInt objects', () => {
    assertEquals(serializeStructure(BigInt(989898434684646)), {
        root: ['$0'],
        refs: {
            $0: {
                root: '989898434684646',
                type: 'BigInt',
            },
        },
    });
});

Deno.test('serializeStructure() should support Date objects', () => {
    assertEquals(serializeStructure(new Date('2020-07-21T00:00:00.000Z')), {
        root: ['$0'],
        refs: {
            $0: {
                root: '2020-07-21T00:00:00.000Z',
                type: 'Date',
            },
        },
    });
});

Deno.test('serializeStructure() should support RegExp objects', () => {
    assertEquals(serializeStructure(new RegExp('^abc$', 'gi')), {
        root: ['$0'],
        refs: {
            $0: {
                root: {
                    source: '^abc$',
                    flags: 'gi',
                },
                type: 'RegExp',
            },
        },
    });
});

Deno.test('serializeStructure() should support Map objects', () => {
    assertEquals(
        serializeStructure(
            new Map<any, any>([
                ['key', 'value'],
                [{ name: 'bob' }, 99],
            ])
        ),
        {
            root: ['$0'],
            refs: {
                $0: {
                    root: [['$1'], ['$2']],
                    type: 'Map',
                },
                $1: {
                    root: ['key', 'value'],
                },
                $2: {
                    root: [['$3'], 99],
                },
                $3: {
                    root: { name: 'bob' },
                },
            },
        }
    );
});

Deno.test('serializeStructure() should support Set objects', () => {
    assertEquals(
        serializeStructure(
            new Set<any>(['abc', 'def', 99, { name: 'bob' }])
        ),
        {
            root: ['$0'],
            refs: {
                $0: {
                    root: ['abc', 'def', 99, ['$1']],
                    type: 'Set',
                },
                $1: {
                    root: { name: 'bob' },
                },
            },
        }
    );
});

Deno.test('serializeStructure() should support Error objects', () => {
    for (let [type] of errorCases as any) {
        const err = new type('abc');
        assertEquals(serializeStructure(err), {
            root: ['$0'],
            refs: {
                $0: {
                    root: {
                        name: err.name,
                        message: 'abc',
                        stack: err.stack,
                    },
                    type: 'Error',
                },
            },
        });
    }
});

Deno.test(
    'serializeStructure() should require MessagePort objects to be transferred',
    () => {
        const port = new MessagePort(99);

        assertThrows(
            () => {
                serializeStructure(port, [port]);
            },
            Error,
            'Port must be transferred before serialization. Did you forget to add it to the transfer list?'
        );
    }
);

Deno.test('serializeStructure() should support MessagePort objects', () => {
    const port1 = new MessagePort(99);
    const port2 = new MessagePort(99);
    MessagePort.link(port1, port2);
    port1.transfer(() => {});

    assertEquals(serializeStructure(port1, [port1]), {
        root: ['$0'],
        refs: {
            $0: {
                root: {
                    channel: 99,
                },
                type: 'MessagePort',
            },
        },
    });
});

Deno.test(
    'serializeStructure() should not error when given an object without hasOwnProperty',
    () => {
        let obj = {
            myProp: 'abc',
            hasOwnProperty: null,
        };
        assertEquals(serializeStructure(obj), {
            root: {
                hasOwnProperty: null,
                myProp: 'abc',
            },
        });
    }
);

Deno.test(
    'deserializeStructure() should return the root value for primitives',
    () => {
        for (let [value] of primitives) {
            assertEquals(
                deserializeStructure({
                    root: value,
                }),
                {
                    data: value,
                    transferred: [],
                }
            );
        }
    }
);

Deno.test('deserializeStructure() should deserialize circular objects', () => {
    let obj3 = {
        name: 'obj3',
    } as any;
    let obj2 = {
        name: 'obj2',
        obj3: obj3,
    } as any;
    let obj1 = {
        name: 'obj1',
        obj2: obj2,
    } as any;

    obj3.obj1 = obj1;

    const deserialized = deserializeStructure({
        root: ['$0'],
        refs: {
            $0: {
                root: {
                    name: 'obj1',
                    obj2: ['$1'],
                },
            },
            $1: {
                root: {
                    name: 'obj2',
                    obj3: ['$2'],
                },
            },
            $2: {
                root: {
                    name: 'obj3',
                    obj1: ['$0'],
                },
            },
        },
    });
    const result = deserialized.data;

    // Can't use assertEquals because it doesn't handle the circular reference for some reason.
    assert(typeof result === 'object');
    assertEquals(result.name, 'obj1');
    assert(typeof result.obj2 === 'object');
    assertEquals(result.obj2.name, 'obj2');
    assert(typeof result.obj2.obj3 === 'object');
    assertEquals(result.obj2.obj3.name, 'obj3');
    assert(result.obj2.obj3.obj1 === result);
});

Deno.test(
    'deserializeStructure() should deserialize arrays with objects',
    () => {
        assertEquals(
            deserializeStructure({
                root: ['abc', 'def', 123, true, { message: 'Hello' }],
            }),
            {
                data: ['abc', 'def', 123, true, { message: 'Hello' }],
                transferred: [],
            }
        );
    }
);

Deno.test(
    'deserializeStructure() should deserialize arrays with objects',
    () => {
        assertEquals(
            deserializeStructure({
                root: ['abc', 'def', 123, true, { message: 'Hello' }],
            }),
            {
                data: ['abc', 'def', 123, true, { message: 'Hello' }],
                transferred: [],
            }
        );
    }
);

Deno.test('deserializeStructure() should deserialize circular arrays', () => {
    let arr3 = ['arr3'] as any[];
    let arr2 = ['arr2', arr3];
    let arr1 = ['arr1', arr2];
    arr3.push(arr1);

    const deserialized = deserializeStructure({
        root: ['$0'],
        refs: {
            $0: {
                root: ['arr1', ['$1']],
            },
            $1: {
                root: ['arr2', ['$2']],
            },
            $2: {
                root: ['arr3', ['$0']],
            },
        },
    });
    const result = deserialized.data;

    // Can't use assertEquals because it doesn't handle the circular reference for some reason.
    assert(typeof result === 'object');
    assertEquals(result[0], 'arr1');
    assert(typeof result[1] === 'object');
    assertEquals(result[1][0], 'arr2');
    assert(typeof result[1][1] === 'object');
    assertEquals(result[1][1][0], 'arr3');
    assert(result[1][1][1] === result);
});

Deno.test(
    'deserializeStructure() should map transferrables as special references',
    () => {
        let buffer = new ArrayBuffer(64);
        let obj1 = {
            name: 'obj1',
            buffer: buffer,
        };

        assertEquals(
            deserializeStructure({
                root: ['$0'],
                refs: {
                    $0: {
                        root: {
                            name: 'obj1',
                            buffer: ['$1'],
                        },
                    },
                    $1: {
                        root:
                            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
                        type: 'ArrayBuffer',
                    },
                },
            }),
            {
                data: obj1,
                transferred: [],
            }
        );
    }
);

Deno.test(
    'deserializeStructure() should map typed arrays as special references',
    () => {
        for (let [type] of arrayTypes) {
            let buffer = new ArrayBuffer(64);
            let array = new (<any>globalThis)[type](buffer);
            let obj1 = {
                name: 'obj1',
                array: array,
            };

            assertEquals(
                deserializeStructure({
                    root: ['$0'],
                    refs: {
                        $0: {
                            root: {
                                name: 'obj1',
                                array: ['$1'],
                            },
                        },
                        $1: {
                            root:
                                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
                            type: type as any,
                        },
                    },
                }),
                {
                    data: obj1,
                    transferred: [],
                }
            );
        }
    }
);

Deno.test('deserializeStructure() should support BigInt objects', () => {
    assertEquals(
        deserializeStructure({
            root: ['$0'],
            refs: {
                $0: {
                    root: '989898434684646',
                    type: 'BigInt',
                },
            },
        }),
        {
            data: BigInt(989898434684646),
            transferred: [],
        }
    );
});

Deno.test('deserializeStructure() should support Date objects', () => {
    assertEquals(
        deserializeStructure({
            root: ['$0'],
            refs: {
                $0: {
                    root: '2020-07-21T00:00:00.000Z',
                    type: 'Date',
                },
            },
        }),
        {
            data: new Date('2020-07-21T00:00:00.000Z'),
            transferred: [],
        }
    );
});

Deno.test('deserializeStructure() should support RegExp objects', () => {
    assertEquals(
        deserializeStructure({
            root: ['$0'],
            refs: {
                $0: {
                    root: {
                        source: '^abc$',
                        flags: 'gi',
                    },
                    type: 'RegExp',
                },
            },
        }),
        {
            data: new RegExp('^abc$', 'gi'),
            transferred: [],
        }
    );
});

Deno.test('deserializeStructure() should support Map objects', () => {
    assertEquals(
        deserializeStructure({
            root: ['$0'],
            refs: {
                $0: {
                    root: [['$1'], ['$2']],
                    type: 'Map',
                },
                $1: {
                    root: ['key', 'value'],
                },
                $2: {
                    root: [['$3'], 99],
                },
                $3: {
                    root: { name: 'bob' },
                },
            },
        }),
        {
            data: new Map<any, any>([
                ['key', 'value'],
                [{ name: 'bob' }, 99],
            ]),
            transferred: [],
        }
    );
});

Deno.test('deserializeStructure() should support Set objects', () => {
    assertEquals(
        deserializeStructure({
            root: ['$0'],
            refs: {
                $0: {
                    root: ['abc', 'def', 99, ['$1']],
                    type: 'Set',
                },
                $1: {
                    root: { name: 'bob' },
                },
            },
        }),
        {
            data: new Set<any>(['abc', 'def', 99, { name: 'bob' }]),
            transferred: [],
        }
    );
});

Deno.test('deserializeStructure() should support Error objects', () => {
    for (let [type] of errorCases as any) {
        const err = new type('abc');
        assertEquals(
            deserializeStructure({
                root: ['$0'],
                refs: {
                    $0: {
                        root: {
                            name: err.name,
                            message: 'abc',
                            stack: err.stack,
                        },
                        type: 'Error',
                    },
                },
            }),
            {
                data: err,
                transferred: [],
            }
        );
    }
});

Deno.test('deserializeStructure() should support MessagePort objects', () => {
    const port1 = new MessagePort(99);

    const { data, transferred } = deserializeStructure({
        root: ['$0'],
        refs: {
            $0: {
                root: {
                    channel: 99,
                },
                type: 'MessagePort',
            },
        },
    });

    assert(typeof data === 'object');
    assert(data instanceof MessagePort);
    assert(Object.getPrototypeOf(data) === Object.getPrototypeOf(port1));
    assert(data.channelID === 99);
    assert(transferred[0] !== data);
});

Deno.test(
    'deserializeStructure() should have a different port for the transferred from in the data',
    () => {
        const deserialized = deserializeStructure({
            root: ['$0'],
            refs: {
                $0: {
                    root: {
                        channel: 99,
                    },
                    type: 'MessagePort',
                },
            },
        });

        assert(deserialized.data !== deserialized.transferred[0]);
    }
);

Deno.test(
    'deserializeStructure() should not error when given an object without hasOwnProperty',
    () => {
        const deserialized = deserializeStructure({
            root: ['$0'],
            refs: {
                $0: {
                    root: {
                        hasOwnProperty: null,
                        myProp: 'abc',
                    },
                },
            },
        });
        assertEquals(deserialized, {
            data: {
                hasOwnProperty: null,
                myProp: 'abc',
            },
            transferred: [],
        });
    }
);
