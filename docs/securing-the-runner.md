---
title: Securing the Runner
---

## Overview

Since the runner grants the ability to execute arbitrary code, you should secure by enabling OIDC and
restricting access to the runner to authorized users. The Cloud Assistant uses OIDC and your identity
provider to authenticate users. The runner then enforces authorization policies to restrict access.

## Enable OIDC

To enable OIDC you need to fill out the `assistantServer.oidc` section of the configuration file
`~/.cloud-assistant/config.yaml`

```yaml
apiVersion: ""
kind: Config
assistantServer:
    ...
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

The section you fill out will depend on your OpenID provider.

### Microsoft Entra ID

For Microsoft Entra ID, your OIDC config should look like

```
assistantServer:
  oidc:
    generic:
        clientID: <YOUR CLIENT ID>
        clientSecret: <YOUR CLIENT SECRET>
        redirectURL: http://localhost:8080/oidc/callback
        discoveryURL: https://login.microsoftonline.com/<TENANT ID>/v2.0/.well-known/openid-configuration
        scopes:
            - "openid"
            - "email"
        issuer: https://login.microsoftonline.com/<TENANT ID>/v2.0
```

## Configure an IAM Policy

You configure an IAM policy to restrict users who can access the agent and runner as illusrated below.


```
kind: Config
...
iamPolicy:
    bindings:
    - role: role/agent.user
      members:
      - name: bob@acme.com
    - role: role/runner.user
      members:
      - name: bob@acme.com
```




