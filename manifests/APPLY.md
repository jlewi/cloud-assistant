---
cwd: ..
---

```sh {"terminalRows":"3"}
kubectl create ns cloud-assistant
```

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

```sh {"terminalRows":"7"}
kubectl delete -k manifests
```

```sh {"terminalRows":"7"}
kubectl apply -k manifests
```

```sh {"background":"true"}
kubectl get pods -n cloud-assistant -w
```

```sh {"background":"true"}
sudo minikube tunnel
```

```sh {"terminalRows":"3"}
kubectl rollout restart -n cloud-assistant deploy cloud-assistant-ui
```

```sh {"terminalRows":"34"}
kubectl logs -n cloud-assistant -l app=cloud-assistant-ui
```

## Expose locally

```sh {"background":"true"}
kubectl port-forward svc/cloud-assistant-ui -n cloud-assistant 5443:8443
```