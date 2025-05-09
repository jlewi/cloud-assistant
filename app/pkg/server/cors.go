package server

import (
  "github.com/jlewi/cloud-assistant/app/pkg/logs"
  "net/http"
)

// SetOriginHeader is middleware that copies the Origin header from the request to the response
// This is necessary when using AllowAllOrigins because the browser will complain if the response header
// is the "*" and not the same origin as on the request. The cors handler in the connect library doesn't do
// this by default.
func SetOriginHeader(h http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    log := logs.FromContext(r.Context())
    if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
      log.Info("Setting Access-Control-Allow-Origin header", "origin", r.Header["Origin"])
      w.Header()["Access-Control-Allow-Origin"] = r.Header["Origin"]
      // http.StatusNoContent is used for preflight requests
      w.WriteHeader(http.StatusNoContent)
    } else {
      log.Info("Calling next handler", "method", r.Method, "url", r.URL.String())
      h.ServeHTTP(w, r)
    }
  })
}
