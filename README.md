# deno-vm

[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/casual-simulation/node-deno-vm/Continuous%20Integration)](https://github.com/casual-simulation/node-deno-vm/actions?query=workflow%3A%22Continuous+Integration%22) [![npm](https://img.shields.io/npm/v/deno-vm)](https://www.npmjs.com/package/deno-vm)

A VM module for Node.js that utilizes the secure environment provided by Deno.

[API Documentation](https://docs.casualsimulation.com/node-deno-vm/)

## Features

-   Secure out-of-process VM environment provided by [Deno](https://deno.land).
-   Web Worker-like API
-   Supports Windows, MacOS, and Linux.
-   Tunable permissions (via Deno's permissions).
-   Supports passing ArrayBuffer, TypedArray, Maps, Sets, Dates, RegExp, Errors, MessagePorts, and circular objects.

## Installation

Note that [Deno](https://deno.land/) needs to be installed and available on the PATH.

```
npm install deno-vm
```

## Usage

```typescript
import { DenoWorker } from 'deno-vm';

const script = `
    self.onmessage = (e) => {
        self.postMessage(e.data * 2);
    };
`;

const worker = new DenoWorker(script);

worker.onmessage = (e) => {
    console.log('Number: ' + e.data);
};

worker.postMessage(2);
// Number: 4
```

## Dependencies

**deno-vm** depends on the following packages:

-   [`ws`](https://github.com/websockets/ws) - Used for interprocess communication between the Node.js process and Deno. Stopgap solution until Deno gets [IPC support](https://github.com/denoland/deno/issues/2585).
-   [`base64-js`](https://github.com/beatgammit/base64-js) - Used to serialize/deserialize binary data into JSON.

## License

```
MIT License

Copyright (c) 2020 Casual Simulation, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
