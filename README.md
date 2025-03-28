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

```bash
cd app
make build
```

### Start the server

```bash
./app/.build/cas
```

Open up `http://localhost:8080`.

### Development Mode

If you make changes to the UI you need to rerun `npm run build` to recompile the static assets.
However, you don't need to restart the GoLang server; it is sufficient to refresh the page to pick up the
latest static assets.
