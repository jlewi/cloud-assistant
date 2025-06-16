# Cloud Assistant UI

This is the front end for the Cloud Assistant.

It was originally created from the [Quick Start App For the Assistants API](https://github.com/openai/openai-assistants-quickstart.git)

./app golang server
./ui is a client side web application intended to be served by the golang server

## Quickstart Setup

### Configure OpenAI

Create a configuration file `~/.cloud-assistant/config.yaml`

```yaml
apiVersion: ""
kind: ""
logging:
    level: info
openai:
    apiKeyFile: /Users/${USER}/secrets/openai.key
cloudAssistant:
    vectorStores:
        - ${VSID}
webApp:
    reconnect: true
assistantServer:
    bindAddress: ""
    port: 0
    httpMaxReadTimeout: 0s
    httpMaxWriteTimeout: 0s
    staticAssets: /Users/${USER}/git_cloud-assistant/web/dist
    runnerService: true
    corsOrigins:
    - "http://localhost:5173"
    - "http://localhost:3000"
    oidc:
        google:
            clientCredentialsFile: /Users/${USER}/.cloud-assistant/client_credentials.json
            discoveryURL: https://accounts.google.com/.well-known/openid-configuration
        generic:
            clientID: your-client-id-here
            clientSecret: your-client-secret-here
            redirectURL: http://localhost:8080/auth/callback
            discoveryURL: https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration
            scopes:
                - "openid"
                - "email"
            issuer: https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0 # TODO: change this to your own tenant ID
        forceApproval: false # helpful for troubleshooting issues with OIDC
```

* set **apiKeyFile** to the path of your OpenAI API key
* set **vectoreStores** to contain the ID of your OpenAI API vector store
* Change the path to the static assets to the location where you checked out the repository

```sh
 cd ${REPOSITORY}
./app/.build/cas config set assistantServer.staticAssets=$(PWD)/web/dist
```

### Build the static assets

```sh
cd /Users/${USER}/git_cloud-assistant/web/
npm install
npm run build
```

### Build and start the server

```bash {"name":"build"}
cd app
make build
```

### Start the server

```bash {"name":"serve"}
./app/.build/cas serve
```

Open up `http://localhost:8080`.

### Development Mode

If you make changes to the UI you need to rerun `npm run build` to recompile the static assets.
However, you don't need to restart the GoLang server; it is sufficient to refresh the page to pick up the
latest static assets.

## Local Tracing

It's handy to have local tracing for debugging. Make sure to configure the OTLP
endpoint in the config.yaml file.

```yaml
telemetry:
  otlpHTTPEndpoint: localhost:4318
```

### Run Jaeger locally

```sh {"name":"jaeger"}
docker run --rm --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  -p 5778:5778 \
  -p 9411:9411 \
  jaegertracing/jaeger:2.6.0
```

## Build the docker container

The image is published in GHCR https://github.com/jlewi/cloud-assistant/pkgs/container/cloud-assistant

```bash {"terminalRows":"21"}
docker build -t cas:latest  -f Dockerfile ./
```

To run the image

```bash
docker run --mount type=bind,src=${HOME}/.cloud-assistant/config.yaml,target=/config/config.yaml \
    -it \
    cas:latest \
    /cas serve --config=/config/config.yaml

```

### Error:

If you get an error like the following when running the frontend in dev mode

```plaintext
The file does not exist at "/Users/jlewi/git_cloud-assistant/web/node_modules/.vite/deps/chunk-ZPXU25OQ.js?v=a1c6069e" which is in the optimize deps directory. The dependency might be incompatible with the dep optimizer. Try adding it to `optimizeDeps.exclude`. (x2)
The file does not exist at "/Users/jlewi/git_cloud-assistant/web/node_modules/.vite/deps/chunk-YSO7LL5L.js?v=a1c6069e" which is in the optimize deps directory. The dependency might be incompatible with the dep optimizer. Try adding it to `optimizeDeps.exclude`.
```

Try running `npm run build` and then `npm run dev` again.
