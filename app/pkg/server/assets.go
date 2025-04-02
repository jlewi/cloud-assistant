package server

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist/index.*
var embeddedAssets embed.FS

// getAssetHandler serves embedded assets or falls back to static assets directory
func getAssetHandler(staticAssets string) http.Handler {
	// If staticAssets is provided, prefer it
	if staticAssets != "" {
		return http.FileServer(http.Dir(staticAssets))
	}

	// Try to use embedded assets
	distFS, _ := fs.Sub(embeddedAssets, "dist")
	_, err := distFS.Open("index.js")
	if err == nil {
		return http.FileServer(http.FS(distFS))
	}

	// Neither staticAssets is set nor embedded assets are available
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "No assets available: static or embedded assets not found", http.StatusInternalServerError)
	})
}
