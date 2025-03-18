## Bring up Runme kernel

```sh {"background":"true","name":"kernel"}
runme server --dev --address 127.0.0.1:9888 --tls /tmp/assistants/runme/tls
```

## Run dev server

```sh {"name":"dev"}
npm run dev
```

## Harvest WebComponents

```sh {"name":"renderers"}
export RUNME_EXTENSION_PATH="../../../oss/vscode-runme"
mkdir -p ./app/components/renderers
cp -v $RUNME_EXTENSION_PATH/out/client.* ./app/components/renderers/
cp -v $RUNME_EXTENSION_PATH/out/*.d.ts ./app/components/renderers/
```