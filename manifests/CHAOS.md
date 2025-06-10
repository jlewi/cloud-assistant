```sh {"terminalRows":"3"}
helm repo add chaos-mesh https://charts.chaos-mesh.org
```

```sh {"terminalRows":"4"}
kubectl create ns chaos-mesh
```

```sh
helm install chaos-mesh chaos-mesh/chaos-mesh -n=chaos-mesh --set chaosDaemon.runtime=containerd --set chaosDaemon.socketPath=/run/containerd/containerd.sock --version 2.7.2
```

```sh {"terminalRows":"12"}
kubectl get pods --namespace chaos-mesh -l app.kubernetes.io/instance=chaos-mesh
```

```sh {"background":"true","terminalRows":"7"}
kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333
```