---
title: Troubleshooting
---

## Websocket Closed With 1006

### Symptom

You try to execute a cell and you get an error; websocket closed with 1006.

### Check Runner Endpoint Path Is Correct

Ensure the path for the runner endpoint is correct.

* Protocol (ws or wss) should match TLS configuration
* The path should be `/ws`.

### Check ws/wss protocol matches TLS configuration

Check that the protocol used for the Runner Endpoint Configuration matches the configuration of your server.

|Protocol | TLS Configuration              |
|---------|--------------------------------|
ws     | Disabled | Not secure (no TLS) |
wss    | Enabled (TLS)                 |


### Self-signed Certificate

If you are using TLS for the Runner (wss protocol) and you have a self-signed certificate you will get this error.
The server will show the error.

```plaintext
2025/04/29 13:58:12 http: TLS handshake error from [::1]:57040: remote error: tls: unknown certificate
```

### Unknown TLS Certificate

If you imported your TLS Certificate into keychain and the backend is showing the error

```
2025/05/02 09:30:20 http: TLS handshake error from [::1]:49795: remote error: tls: unknown certificate
```

Try

1. Deleting the certificate in keychain
1. Reimporting the certificate

It looks like if you already imported a `Cloud Assistant Certificate` into keychain, the new certificate will not
get imported so you have to delete it first.

TODO(jlewi@): What's a better solution for this?
