---
cwd: ..
---

## Replace the cert and key with your own

```sh {"terminalRows":"2"}
kubectl create -n cloud-assistant secret tls tls-certs \
  --cert ~/.cloud-assistant/cert.pem \
  --key ~/.cloud-assistant/key.pem \
  --dry-run=client -o yaml | \
kubectl apply -f -
```

```sh {"terminalRows":"2"}
kubectl create -n cloud-assistant secret generic openai \
  --from-file=apikey=/Users/${USER}/.cloud-assistant/openai_key_file \
  --dry-run=client -o yaml | \
kubectl apply -f -
```

```sh
kubectl delete -k manifests
kubectl apply -k manifests
```

```sh
kubectl rollout restart -n cloud-assistant deploy cloud-assistant-ui
```

```sh {"terminalRows":"20"}
kubectl logs -n cloud-assistant -l app=cloud-assistant-ui
```

## Expose locally

```sh
kubectl expose -n cloud-assistant deployment cloud-assistant-ui \
  --name cloud-assistant-ui \
  --port 5443 \
  --target-port cloud-assi-tls \
  --type ClusterIP

```

```sh {"background":"true"}
kubectl port-forward svc/cloud-assistant-ui -n cloud-assistant 5443:5443
```