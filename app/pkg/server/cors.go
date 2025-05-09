package server

import "net/http"

// SetOriginHeader is middleware that copies the Origin header from the request to the response
// This is necessary when using AllowAllOrigins because the browser will complain if the response header
// is the "*" and not the same origin as on the request. The cors handler in the connect library doesn't do
// this by default.
func SetOriginHeader(h http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
      w.Header()["Access-Control-Allow-Origin"] = r.Header["Origin"]
      // http.StatusNoContent is used for preflight requests
      w.WriteHeader(http.StatusNoContent)
    } else {
      h.ServeHTTP(w, r)
    }
  })
}
