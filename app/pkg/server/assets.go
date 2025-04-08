package server

import (
	"embed"
	"io/fs"
	"net/http"
	"os"

	"github.com/go-logr/zapr"
	"github.com/pkg/errors"
	"go.uber.org/zap"
)

//go:embed dist/index.*
var embeddedAssets embed.FS

// getAssetFileSystem returns a filesystem for serving web assets
// Uses staticAssets directory if specified, otherwise uses embedded assets
// Returns error if neither option is available
func getAssetFileSystem(staticAssets string) (fs.FS, error) {
	log := zapr.NewLogger(zap.L())
	// If staticAssets is provided, prefer it
	if staticAssets != "" {
		log.Info("Serving static assets", "dir", staticAssets)
		return os.DirFS(staticAssets), nil
	}

	// Try to use embedded assets
	distFS, _ := fs.Sub(embeddedAssets, "dist")
	_, err := distFS.Open("index.js")
	if err == nil {
		log.Info("Serving embedded assets")
		return distFS, nil
	}

	// Neither staticAssets is set nor embedded assets are available
	return nil, fs.ErrNotExist
}

// serveSinglePageApp serves a single-page app from static or embedded assets,
// falling back to index for client-side routing when files don't exist.
func (s *Server) serveSinglePageApp() error {
	assetsFS, err := getAssetFileSystem(s.serverConfig.StaticAssets)
	if err != nil {
		return errors.Wrapf(err, "Failed to get asset handler")
	}

	fileServer := http.FileServer(http.FS(assetsFS))

	s.engine.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := "/"
		if len(r.URL.Path) > 1 {
			path = r.URL.Path[1:]
		}

		// If path is empty or file doesn't exist, serve index
		if path == "/" || os.IsNotExist(func() error {
			_, err := assetsFS.Open(path)
			return err
		}()) {
			// Serve index and rely on client-side routing
			r.URL.Path = "/"
		}

		fileServer.ServeHTTP(w, r)
	}))

	return nil
}