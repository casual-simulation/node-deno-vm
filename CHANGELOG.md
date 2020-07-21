# Changelog

## v0.5.0

### Date: 7/21/2020

### Changes:

-   Added the `DenoWorker` class.
    -   It is a Web Worker-like API that gives you the ability to run arbitrary scripts inside Deno.
    -   Supports the structure-clone algorithm for Maps, Sets, BigInts, ArrayBuffers, Errors, and circular object references.
    -   Requires that Deno be installed on the system.
