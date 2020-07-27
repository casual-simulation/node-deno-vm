# Changelog

## v0.7.0-alpha.0

### Date: 7/27/2020

### Changes:

-   Added a global WebSocket polyfill since Deno doesn't implement the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

## v0.6.2

### Date: 7/23/2020

### Changes:

-   Exported MessageChannel and MessagePort.
-   Added `polyfillMessageChannel()` to polyfill the MessageChannel and MessagePort objects on the global object.

## v0.6.1

### Date: 7/22/2020

### Changes:

-   Fixed an issue where permissions were being passed incorrectly.

## v0.6.0

### Date: 7/22/2020

### Changes:

-   Added the ability to transfer `MessagePort` instances between the host and worker.

## v0.5.0

### Date: 7/21/2020

### Changes:

-   Added the `DenoWorker` class.
    -   It is a Web Worker-like API that gives you the ability to run arbitrary scripts inside Deno.
    -   Supports the structure-clone algorithm for Maps, Sets, BigInts, ArrayBuffers, Errors, and circular object references.
    -   Requires that Deno be installed on the system.
