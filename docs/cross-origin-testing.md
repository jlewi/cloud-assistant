## Cross-Origin Testing

It's not uncommon to have the agent run under a different origin than available runners. Here's a simple way to replicate this setup locally.

First, install Caddy.

```sh
brew install caddy
```

Make sure to setup the local server to run on port `localhost:8443` with TLS using a self-signed certificate. Steps are documented [here](setup.md). Add a alternative hostname to your `/etc/hosts` file:

```plaintext
[...]

127.0.0.1 runner.localhost
```

Then, run the following command to use a reverse proxy to emulate a different origin. Please note that Caddy might prompt for a `sudo` password to add your internal CA certificate to the system keychain.

```sh {"name":"cors-proxy"}
caddy reverse-proxy --internal-certs --from runner.localhost:9443 --to https://localhost:8443
```

Additional tasks to note:

* Adjust the `redirectURL` in the `config.yaml` file to point to `runner.localhost:9443` to get authentication working
* You might have to include the `runner.localhost` in your IdP's allowed redirect URLs
* Modify the `runner.localhost:9443` runner settings to point at `wss://localhost:8443`