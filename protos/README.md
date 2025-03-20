# Cloud Assistant Protocol Buffers

This directory defines the RPCs and datastructures used by our Cloud Assistant.
The Cloud Assistant has a frontend-backend architecture with a frontend written in REACT and Typescript
and a GoLang backend. So we rely on protocol buffers to have a well defined interface between the two.

## Vendoring

We currently vendor the GoLang and Typescript generated code into the monorepo. In the future we can explore
building it on demand using bazel.

## Developer Guide

Language bindings are generated using [buf](https://buf.build/docs/introduction)

```sh
buf generate
```

```sh
buf config init
```

## Generate the protocol buffers

```sh
buf generate
```
