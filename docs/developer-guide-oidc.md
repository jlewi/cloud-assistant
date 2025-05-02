---
title: OIDC Developer Guide
---

## Running Development Builds With OIDC Enabled

OIDC requires that the frontend be served on the same origin as the origin used for the OIDC authorization
callback.
This is enforced in code [here](https://github.com/jlewi/cloud-assistant/commit/4fe06ebc64a9144f63f2fd68f70891284062b224#diff-1b68574ac0226e781756af4ee6b4568a62d74838661ea5d2e2434609212bb44cR57).
More importantly its required by the OIDC 3 legged authorization flow. I think this might also
be required by the OAuth flow so that the server can set the session cookie.

This means you can't use `npm run dev` to run the frontend and talk to a `GoLang` server that is started
separately and running on a different host.

So to run it locally

1. Run `npm run build` to build the frontend.
2. Start the backend

   ```
   cd app
   make build
   ./app/.build/cas serve
   ```

