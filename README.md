# node-deno-vm

[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/casual-simulation/node-deno-vm/Continuous%20Integration)](https://github.com/casual-simulation/node-deno-vm/actions?query=workflow%3A%22Continuous+Integration%22)

A VM module for Node.js that utilizes the secure environment provided by Deno.

## Features

-   Secure out-of-process VM environment provided by [Deno](https://deno.land).
-   Web Worker-like API
-   Supports Windows, MacOS, and Linux.
-   Tunable permissions (via Deno's permissions).
-   Supports passing ArrayBuffer, TypedArray, Maps, Sets, Dates, RegExp, Errors, and circular objects.

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
