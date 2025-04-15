package server

import (
	"bytes"
	"embed"
	"io/fs"
	"net/http"
	"os"

	"github.com/go-logr/zapr"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
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
	return nil, errors.New("no assets available: neither staticAssets directory is configured nor embedded assets could be found")
}

// processIndexHTMLWithConfig reads the index.html file and injects configuration values
// such as authentication requirements into the HTML content
func processIndexHTMLWithConfig(assetsFS fs.FS, oidcConfig *config.OIDCConfig) ([]byte, error) {
	// Read index.html
	file, err := assetsFS.Open("index.html")
	if err != nil {
		return nil, errors.Wrap(err, "failed to open index.html")
	}
	defer func() {
		if err := file.Close(); err != nil {
			zap.L().Error("failed to close index.html file", zap.Error(err))
		}
	}()

	// Read the file content
	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(file); err != nil {
		return nil, errors.Wrap(err, "failed to read index.html content")
	}
	content := buf.Bytes()

	// Define template values
	templateValues := map[string][]byte{}

	if oidcConfig != nil {
		templateValues["{ requireAuth: false }"] = []byte("{ requireAuth: true }")
	}

	// Replace each template value
	for placeholder, value := range templateValues {
		content = bytes.ReplaceAll(content, []byte(placeholder), value)
	}

	return content, nil
}

// singlePageAppHandler serves a single-page app from static or embedded assets,
// falling back to index for client-side routing when files don't exist.
func (s *Server) singlePageAppHandler() (http.Handler, error) {
	assetsFS, err := getAssetFileSystem(s.serverConfig.StaticAssets)
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to get asset handler")
	}

	fileServer := http.FileServer(http.FS(assetsFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := "/"
		if len(r.URL.Path) > 1 {
			path = r.URL.Path[1:]
		}

		// If path is empty, file doesn't exist, or it's index.html, serve processed index
		if path == "/" || path == "index.html" || os.IsNotExist(func() error {
			_, err := assetsFS.Open(path)
			return err
		}()) {
			// Read and process index.html
			content, err := processIndexHTMLWithConfig(assetsFS, s.serverConfig.OIDC)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Set content type and write the modified content
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write(content)
			return
		}

		fileServer.ServeHTTP(w, r)
	}), nil
}
