# Cloud Assistant UI

This is the front end for the Cloud Assistant.

It was originally created from the [Quick Start App For the Assistants API](https://github.com/openai/openai-assistants-quickstart.git)

## Quickstart Setup

./app golang server
./ui is a client side web application intended to be served by the golang server 

### Build the static ui

#### Install dependencies

```sh
cd ui
npm install
```

#### Build the static assets

```sh
cd ui
npm run build
```

### Build the server

```bash
cd app
make build
```

### Configure the server 

Configure the server to serve the static assets

```
./app/.build/cas config set assistantServer.staticAssets=$(PWD)/ui/out
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