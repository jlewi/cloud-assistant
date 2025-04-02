package server

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/go-logr/zapr"
	"go.uber.org/zap"
)

//go:embed dist/index.*
var embeddedAssets embed.FS

// getAssetHandler serves embedded assets or falls back to static assets directory
func getAssetHandler(staticAssets string) http.Handler {
	log := zapr.NewLogger(zap.L())
	// If staticAssets is provided, prefer it
	if staticAssets != "" {
		log.Info("Serving static assets", "dir", staticAssets)
		return http.FileServer(http.Dir(staticAssets))
	}

	// Try to use embedded assets
	distFS, _ := fs.Sub(embeddedAssets, "dist")
	_, err := distFS.Open("index.js")
	if err == nil {
		log.Info("Serving embedded assets")
		return http.FileServer(http.FS(distFS))
	}

	// Neither staticAssets is set nor embedded assets are available
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "No assets available: static or embedded assets not found", http.StatusInternalServerError)
	})
}
