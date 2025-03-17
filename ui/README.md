# Cloud Assistant UI

This is the front end for the Cloud Assistant.

It was originally created from the [Quick Start App For the Assistants API](https://github.com/openai/openai-assistants-quickstart.git)

## Quickstart Setup

### 3. Install dependencies

```sh
npm install
```

### 4. Run

```sh
npm run dev
```

### 5. Navigate to [http://localhost:3000](http://localhost:3000).

## Deployment

TODO(jlewi): You need an OpenAI key

# To deploy / update the configmap used by the deployment

```sh
kustomize build manifests | kubectl apply -f -
```

## Run A Production Build Locally

```bash
npm run build
```

## Overview

### Pages

- Cloud Assistant Example: [http://localhost:3000/examples/file-search](http://localhost:3000/examples/file-search)

### Main Components

- `app/components/chat.tsx` - handles chat rendering, [streaming](https://platform.openai.com/docs/assistants/overview?context=with-streaming), and [function call](https://platform.openai.com/docs/assistants/tools/function-calling/quickstart?context=streaming&lang=node.js) forwarding
- `app/components/file-viewer.tsx` - handles uploading, fetching, and deleting files for [file search](https://platform.openai.com/docs/assistants/tools/file-search)

### Endpoints

TODO(jlewi): This is all outdated

- `api/assistants` - `POST`: create assistant (only used at startup)
- `api/assistants/threads` - `POST`: create new thread
- `api/assistants/threads/[threadId]/messages` - `POST`: send message to assistant
- `api/assistants/threads/[threadId]/actions` - `POST`: inform assistant of the result of a function it decided to call
- `api/assistants/files` - `GET`/`POST`/`DELETE`: fetch, upload, and delete assistant files for file search

## Deploying

### Create the secret

To create your secret in the namespace

kubectl -n cloud-assistant create secret generic cloud-assistant-openai-api-key --from-file=api_key=${HOME}/secrets/cloud-assistant-openai-api-key

### Deploy the UI

TODO(jlewi): Update this
