---
title: Setup
---

## Local Runner with HTTPs

If you are accessing the frontend over HTTPs, you need to set up your runner with HTTPS otherwise chrome will complain.
If you are running locally you can use a self signed certificate.

### Enable TLS

Enable TLS in the ~/.cloud-assistant/config.yaml file.

```yaml
apiVersion: ""
kind: ""
...
assistantServer:
    tlsConfig:
        generate: true
```

By setting `generate: true` the server will generate a self signed certificate and use it.

### Add Certificate to System Keychain

You need to add the certificate to your system's keychain so that it is trusted by the browser.

On MacOS, you can do this with the following command:

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.cloud-assistant/cert.pem
```

### Configure the webapp

In the webapp click settings and set the runner endpoint to `wss://localhost:8443/ws`.
