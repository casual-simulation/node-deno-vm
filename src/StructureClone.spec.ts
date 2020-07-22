import { serializeStructure, deserializeStructure } from './StructureClone';
import { MessagePort, MessageChannel } from './MessageChannel';

describe('StructureClone', () => {
    const primitives = [
        [true],
        [false],
        [0],
        [1],
        ['string'],
        [undefined],
        [null],
    ];
    const arrayTypes = [
        ['Uint8Array'],
        ['Uint16Array'],
        ['Uint32Array'],
        ['Int8Array'],
        ['Int16Array'],
        ['Int32Array'],
    ];
    const errorCases = [
        ['Error', Error],
        ['EvalError', EvalError],
        ['RangeError', RangeError],
        ['ReferenceError', ReferenceError],
        ['SyntaxError', SyntaxError],
        ['TypeError', TypeError],
        ['URIError', URIError],
    ];
    describe('serializeStructure()', () => {
        it.each(primitives)(
            'should return an object with root set to %s',
            (value: any) => {
                expect(serializeStructure(value)).toEqual({
                    root: value,
                });
            }
        );

        it('should serialize non-circular objects normally', () => {
            let obj1 = {
                name: 'obj1',
                obj2: {
                    name: 'obj2',
                    obj3: {
                        name: 'obj3',
                    },
                },
            };

            expect(serializeStructure(obj1)).toEqual({
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
        });

        it('should add circular references to the refs map', () => {
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

            expect(serializeStructure(obj1)).toEqual({
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
        });

        it('should handle simple arrays', () => {
            expect(serializeStructure(['abc', 'def', 123, true])).toEqual({
                root: ['abc', 'def', 123, true],
            });
        });

        it('should handle arrays with objects', () => {
            expect(
                serializeStructure([
                    'abc',
                    'def',
                    123,
                    true,
                    { message: 'Hello' },
                ])
            ).toEqual({
                root: ['abc', 'def', 123, true, { message: 'Hello' }],
            });
        });

        it('should handle circular arrays', () => {
            let arr3 = ['arr3'] as any[];
            let arr2 = ['arr2', arr3];
            let arr1 = ['arr1', arr2];
            arr3.push(arr1);

            expect(serializeStructure(arr1)).toEqual({
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

        it('should map transferrables as special references', () => {
            let buffer = new ArrayBuffer(64);
            let obj1 = {
                name: 'obj1',
                buffer: buffer,
            };

            expect(serializeStructure(obj1, [buffer])).toEqual({
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
        });

        it.each(arrayTypes)('should map %s as special references', (type) => {
            let buffer = new ArrayBuffer(64);
            let array = new (<any>globalThis)[type](buffer);
            let obj1 = {
                name: 'obj1',
                array: array,
            };

            expect(serializeStructure(obj1, [buffer])).toEqual({
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
        });

        it('should support BigInt objects', () => {
            expect(serializeStructure(BigInt(989898434684646))).toEqual({
                root: ['$0'],
                refs: {
                    $0: {
                        root: '989898434684646',
                        type: 'BigInt',
                    },
                },
            });
        });

        it('should support Date objects', () => {
            expect(
                serializeStructure(new Date('2020-07-21T00:00:00.000Z'))
            ).toEqual({
                root: ['$0'],
                refs: {
                    $0: {
                        root: '2020-07-21T00:00:00.000Z',
                        type: 'Date',
                    },
                },
            });
        });

        it('should support RegExp objects', () => {
            expect(serializeStructure(new RegExp('^abc$', 'gi'))).toEqual({
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

        it('should support Map objects', () => {
            expect(
                serializeStructure(
                    new Map<any, any>([
                        ['key', 'value'],
                        [{ name: 'bob' }, 99],
                    ])
                )
            ).toEqual({
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
            });
        });

        it('should support Set objects', () => {
            expect(
                serializeStructure(
                    new Set<any>(['abc', 'def', 99, { name: 'bob' }])
                )
            ).toEqual({
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
            });
        });

        it.each(errorCases)(
            'should support %s objects',
            (desc: string, type: any) => {
                const err = new type('abc');
                expect(serializeStructure(err)).toEqual({
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
        );

        it('should require MessagePort objects to be transferred', () => {
            const port = new MessagePort(99);

            expect(() => {
                serializeStructure(port, [port]);
            }).toThrow(
                new Error(
                    'Port must be transferred before serialization. Did you forget to add it to the transfer list?'
                )
            );
        });

        it('should support MessagePort objects', () => {
            const port1 = new MessagePort(99);
            const port2 = new MessagePort(99);
            MessagePort.link(port1, port2);
            port1.transfer(() => {});

            expect(serializeStructure(port1, [port1])).toEqual({
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
    });

    describe('deserializeStructure', () => {
        it.each(primitives)(
            'should return the root value for %s',
            (value: any) => {
                expect(
                    deserializeStructure({
                        root: value,
                    })
                ).toEqual({
                    data: value,
                    transferred: [],
                });
            }
        );

        it('should deserialize circular objects', () => {
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

            expect(
                deserializeStructure({
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
                })
            ).toEqual({
                data: obj1,
                transferred: [],
            });
        });

        it('should deserialize arrays with objects', () => {
            expect(
                deserializeStructure({
                    root: ['abc', 'def', 123, true, { message: 'Hello' }],
                })
            ).toEqual({
                data: ['abc', 'def', 123, true, { message: 'Hello' }],
                transferred: [],
            });
        });

        it('should deserialize circular arrays', () => {
            let arr3 = ['arr3'] as any[];
            let arr2 = ['arr2', arr3];
            let arr1 = ['arr1', arr2];
            arr3.push(arr1);

            expect(
                deserializeStructure({
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
                })
            ).toEqual({
                data: arr1,
                transferred: [],
            });
        });

        it('should map transferrables as special references', () => {
            let buffer = new ArrayBuffer(64);
            let obj1 = {
                name: 'obj1',
                buffer: buffer,
            };

            expect(
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
                })
            ).toEqual({
                data: obj1,
                transferred: [],
            });
        });

        it.each(arrayTypes)('should map %s as special references', (type) => {
            let buffer = new ArrayBuffer(64);
            let array = new (<any>globalThis)[type](buffer);
            let obj1 = {
                name: 'obj1',
                array: array,
            };

            expect(
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
                })
            ).toEqual({
                data: obj1,
                transferred: [],
            });
        });

        it('should support BigInt objects', () => {
            expect(
                deserializeStructure({
                    root: ['$0'],
                    refs: {
                        $0: {
                            root: '989898434684646',
                            type: 'BigInt',
                        },
                    },
                })
            ).toEqual({
                data: BigInt(989898434684646),
                transferred: [],
            });
        });

        it('should support Date objects', () => {
            expect(
                deserializeStructure({
                    root: ['$0'],
                    refs: {
                        $0: {
                            root: '2020-07-21T00:00:00.000Z',
                            type: 'Date',
                        },
                    },
                })
            ).toEqual({
                data: new Date('2020-07-21T00:00:00.000Z'),
                transferred: [],
            });
        });

        it('should support RegExp objects', () => {
            expect(
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
                })
            ).toEqual({
                data: new RegExp('^abc$', 'gi'),
                transferred: [],
            });
        });

        it('should support Map objects', () => {
            expect(
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
                })
            ).toEqual({
                data: new Map<any, any>([
                    ['key', 'value'],
                    [{ name: 'bob' }, 99],
                ]),
                transferred: [],
            });
        });

        it('should support Set objects', () => {
            expect(
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
                })
            ).toEqual({
                data: new Set<any>(['abc', 'def', 99, { name: 'bob' }]),
                transferred: [],
            });
        });

        it.each(errorCases)(
            'should support %s objects',
            (desc: string, type: any) => {
                const err = new type('abc');
                expect(
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
                    })
                ).toEqual({
                    data: err,
                    transferred: [],
                });
            }
        );

        it('should support MessagePort objects', () => {
            const channel = new MessageChannel(99);

            expect(
                deserializeStructure({
                    root: ['$0'],
                    refs: {
                        $0: {
                            root: {
                                channel: 99,
                            },
                            type: 'MessagePort',
                        },
                    },
                })
            ).toEqual({
                data: channel.port1,
                transferred: [channel.port2],
            });
        });

        it('should have a different port for the transferred from in the data', () => {
            const port1 = new MessagePort(99);

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

            expect(deserialized.data).not.toBe(deserialized.transferred[0]);
        });
    });
});
