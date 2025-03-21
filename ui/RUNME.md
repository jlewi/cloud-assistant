## Bring up Runme kernel

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