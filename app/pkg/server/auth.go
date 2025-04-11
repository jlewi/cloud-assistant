package server

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/go-logr/zapr"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
	"github.com/pkg/errors"
	"go.uber.org/zap"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// jwksKey represents a single key in the JWKS
type jwksKey struct {
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// jwks represents the JSON Web Key Set
type jwks struct {
	Keys []jwksKey `json:"keys"`
}

// OIDC handles OAuth2 authentication setup and management
type OIDC struct {
	config     *config.OIDCConfig
	oauth2     *oauth2.Config
	publicKeys map[string]*rsa.PublicKey
}

// NewOIDC creates a new OIDC
func NewOIDC(cfg *config.OIDCConfig) (*OIDC, error) {
	if cfg == nil {
		return nil, nil
	}

	if cfg.Google == nil {
		return nil, nil
	}

	// Read client credentials from file
	bytes, err := os.ReadFile(cfg.Google.ClientCredentialsFile)
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to read client credentials file")
	}

	// Create OAuth2 config using Google's package
	oauth2Config, err := google.ConfigFromJSON(bytes, "openid", "email")
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to create OAuth2 config")
	}

	// Initialize OIDC
	oidc := &OIDC{
		config:     cfg,
		oauth2:     oauth2Config,
		publicKeys: make(map[string]*rsa.PublicKey),
	}

	// Download Google's JWKS for signature verification
	if err := oidc.downloadJWKS(); err != nil {
		return nil, errors.Wrapf(err, "Failed to download JWKS")
	}

	return oidc, nil
}

// downloadJWKS downloads the JSON Web Key Set (JWKS) from Google's OAuth2 provider.
// It fetches the public keys used to verify JWT signatures, decodes them from the
// JWK format, and stores them in the OIDC instance's publicKeys map indexed by key ID.
// This allows the application to verify tokens offline without contacting Google's servers
// for each verification request.
func (o *OIDC) downloadJWKS() error {
	// Google's JWKS URL for signature verification
	jwksURL := "https://www.googleapis.com/oauth2/v3/certs"

	// Fetch the JWKS
	resp, err := http.Get(jwksURL)
	if err != nil {
		return errors.Wrapf(err, "Failed to fetch JWKS from %s", jwksURL)
	}
	defer resp.Body.Close()

	// Parse the JWKS into our structured format
	var jwks jwks
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return errors.Wrapf(err, "Failed to parse JWKS response")
	}

	// Convert each key to RSA public key and store in the map
	for _, key := range jwks.Keys {
		// Convert the modulus and exponent from base64url to *rsa.PublicKey
		n, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			return errors.Wrap(err, "failed to decode modulus")
		}

		e, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil {
			return errors.Wrap(err, "failed to decode exponent")
		}

		// Convert the modulus to a big integer
		modulus := new(big.Int).SetBytes(n)

		// Convert the exponent to an integer
		var exponent int
		if len(e) < 4 {
			for i := range e {
				exponent = exponent<<8 + int(e[i])
			}
		} else {
			return errors.New("exponent too large")
		}

		// Create the RSA public key
		publicKey := &rsa.PublicKey{
			N: modulus,
			E: exponent,
		}

		// Store the public key in the map using the kid as the key
		o.publicKeys[key.Kid] = publicKey
	}

	return nil
}

// SetupOIDC sets up OAuth2 authentication for the server
func (s *Server) SetupOIDC(mux *http.ServeMux) error {
	if s.serverConfig.OIDC == nil {
		return nil
	}

	oidc, err := NewOIDC(s.serverConfig.OIDC)
	if err != nil {
		return errors.Wrapf(err, "Failed to create OAuth2 manager")
	}

	// Register OAuth2 endpoints
	mux.HandleFunc("/oidc/login", oidc.LoginHandler)
	mux.HandleFunc("/oidc/callback", oidc.CallbackHandler)
	mux.HandleFunc("/oidc/logout", oidc.LogoutHandler)

	// Create a new mux that wraps the original mux with OAuth2 protection
	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log := zapr.NewLogger(zap.L())

		// Skip authentication for health checks and OAuth2 endpoints
		if r.URL.Path == "/health" || strings.HasPrefix(r.URL.Path, "/oidc/") {
			mux.ServeHTTP(w, r)
			return
		}

		// Get the session token from the cookie
		cookie, err := r.Cookie("session")
		if err != nil {
			// No session cookie, redirect to login
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Verify the token offline by parsing and validating the JWT
		idToken := cookie.Value

		// Verify the token signature using JWKS
		token, err := jwt.Parse(idToken, func(token *jwt.Token) (interface{}, error) {
			// Verify the signing method is what we expect
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}

			// Get the key ID from the token header
			kid, ok := token.Header["kid"].(string)
			if !ok {
				return nil, errors.New("kid header not found in token")
			}

			// Get the public key from our map
			publicKey, ok := oidc.publicKeys[kid]
			if !ok {
				return nil, errors.New("unable to find appropriate key")
			}

			return publicKey, nil
		})

		if err != nil || !token.Valid {
			log.Error(err, "Invalid token signature")
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

    // IMPORTANT: only after here is it safe to rely on claims

		// Parse the JWT without verifying the signature first
		parts := strings.Split(idToken, ".")
		if len(parts) != 3 {
			log.Error(nil, "Invalid token format")
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Decode the payload (second part)
		payload, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			log.Error(err, "Failed to decode token payload")
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Parse the payload
		var claims struct {
			Exp int64  `json:"exp"`
			Iss string `json:"iss"`
			Aud string `json:"aud"`
			HD  string `json:"hd"`
		}

		if err := json.Unmarshal(payload, &claims); err != nil {
			log.Error(err, "Failed to parse token claims")
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Verify expiration
		if time.Now().Unix() > claims.Exp {
			log.Error(nil, "Token expired")
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Verify issuer (should be Google)
		if !strings.HasPrefix(claims.Iss, "https://accounts.google.com") {
			log.Error(nil, "Invalid token issuer", "issuer", claims.Iss)
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Verify audience matches our client ID
		if claims.Aud != oidc.oauth2.ClientID {
			log.Error(nil, "Invalid token audience", "audience", claims.Aud, "expected", oidc.oauth2.ClientID)
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Verify the hosted domain (hd) is in the list of approved domains
		if claims.HD != "" {
			if !slices.Contains(s.serverConfig.OIDC.Domains, claims.HD) {
				log.Error(nil, "Hosted domain not in allowed domains", "domain", claims.HD)
				http.Redirect(w, r, "/oidc/login", http.StatusFound)
				return
			}
		} else {
			log.Error(nil, "Missing hosted domain claim")
			http.Redirect(w, r, "/oidc/login", http.StatusFound)
			return
		}

		// Token is valid, proceed with the request
		mux.ServeHTTP(w, r)
	})

	// Replace the original mux with the protected one
	s.engine = protectedMux
	return nil
}

// LoginHandler handles the OAuth2 login flow
func (o *OIDC) LoginHandler(w http.ResponseWriter, r *http.Request) {
	state := "random-state" // TODO: Generate a random state
	http.Redirect(w, r, o.oauth2.AuthCodeURL(state), http.StatusFound)
}

// CallbackHandler handles the OAuth2 callback
func (o *OIDC) CallbackHandler(w http.ResponseWriter, r *http.Request) {
	log := zapr.NewLogger(zap.L())

	// Verify state
	state := r.URL.Query().Get("state")
	if state != "random-state" { // TODO: Verify the state matches what we sent
		http.Error(w, "Invalid state", http.StatusBadRequest)
		return
	}

	// Exchange code for token
	code := r.URL.Query().Get("code")
	token, err := o.oauth2.Exchange(r.Context(), code)
	if err != nil {
		log.Error(err, "Failed to exchange code for token")
		http.Error(w, "Failed to exchange code for token", http.StatusInternalServerError)
		return
	}

	// Get the ID token from the response
	idToken, ok := token.Extra("id_token").(string)
	if !ok {
		log.Error(nil, "No ID token in response")
		http.Error(w, "No ID token in response", http.StatusInternalServerError)
		return
	}

	// Set the session cookie with the ID token
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    idToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})

	// Redirect to the home page
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

// LogoutHandler handles the OAuth2 logout
func (o *OIDC) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// Clear the session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	// Redirect to the home page
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}
