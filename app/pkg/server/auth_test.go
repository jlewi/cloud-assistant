package server

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jlewi/cloud-assistant/app/pkg/config"
)

func TestStateManager(t *testing.T) {
	sm := newStateManager(6 * time.Second)

	// Test state generation
	state, err := sm.generateState()
	if err != nil {
		t.Fatalf("Failed to generate state: %v", err)
	}
	if state == "" {
		t.Error("Generated state is empty")
	}

	// Test state validation
	if !sm.validateState(state) {
		t.Error("Valid state was not accepted")
	}
	if sm.validateState(state) {
		t.Error("State was accepted twice")
	}

	// Test state expiration
	state, err = sm.generateState()
	if err != nil {
		t.Fatalf("Failed to generate state: %v", err)
	}
	time.Sleep(sm.stateExpiration + time.Second)
	if sm.validateState(state) {
		t.Error("Expired state was accepted")
	}
}

func TestOIDC_NewOIDC(t *testing.T) {
	// Test with nil config
	oidc, err := newOIDC(nil)
	if err != nil {
		t.Errorf("Expected no error with nil config, got %v", err)
	}
	if oidc != nil {
		t.Error("Expected nil OIDC with nil config")
	}

	// Test with nil Google config
	cfg := &config.OIDCConfig{}
	oidc, err = newOIDC(cfg)
	if err != nil {
		t.Errorf("Expected no error with nil Google config, got %v", err)
	}
	if oidc != nil {
		t.Error("Expected nil OIDC with nil Google config")
	}

	// Test with invalid config
	cfg.Google = &config.GoogleOIDCConfig{
		ClientCredentialsFile: "nonexistent.json",
	}
	oidc, err = newOIDC(cfg)
	if err == nil {
		t.Error("Expected error with invalid config")
	}
	if oidc != nil {
		t.Error("Expected nil OIDC with invalid config")
	}
}

func TestOIDC_Handlers(t *testing.T) {
	// Create a test OIDC instance
	cfg := &config.OIDCConfig{
		Google: &config.GoogleOIDCConfig{
			ClientCredentialsFile: "testdata/google-client-dummy.json",
			DiscoveryURL:          "https://accounts.google.com/.well-known/openid-configuration",
		},
	}
	oidc, err := newOIDC(cfg)
	if err != nil {
		t.Fatalf("Failed to create OIDC instance: %v", err)
	}

	t.Run("LoginHandler", func(t *testing.T) {
		// Create a test request
		req := httptest.NewRequest("GET", "/auth/login", nil)
		w := httptest.NewRecorder()

		// Call the handler
		oidc.loginHandler(w, req)

		// Check the response
		resp := w.Result()
		if resp.StatusCode != http.StatusFound {
			t.Errorf("Expected status %d, got %d", http.StatusFound, resp.StatusCode)
		}

		// Parse the redirect URL
		redirectURL, err := url.Parse(resp.Header.Get("Location"))
		if err != nil {
			t.Fatalf("Failed to parse redirect URL: %v", err)
		}

		// Verify the URL contains required parameters
		if redirectURL.Host != "accounts.google.com" {
			t.Errorf("Expected host accounts.google.com, got %s", redirectURL.Host)
		}
		if clientID := redirectURL.Query().Get("client_id"); clientID != "dummy-client-id" {
			t.Errorf("Expected client_id dummy-client-id, got %s", clientID)
		}
		if state := redirectURL.Query().Get("state"); state == "" {
			t.Error("Expected non-empty state parameter")
		}
	})

	t.Run("CallbackHandler", func(t *testing.T) {
		// Generate a valid state
		state, err := oidc.state.generateState()
		if err != nil {
			t.Fatalf("Failed to generate state: %v", err)
		}

		// Create a test request with invalid state
		req := httptest.NewRequest("GET", "/auth/callback?state=invalid&code=test-code", nil)
		w := httptest.NewRecorder()
		oidc.callbackHandler(w, req)
		resp := w.Result()
		if resp.StatusCode != http.StatusFound {
			t.Errorf("Expected status %d, got %d", http.StatusFound, resp.StatusCode)
			return
		}

		location := resp.Header.Get("Location")
		expectedLocation := "/login?error=invalid_state&error_description=Invalid+state+parameter"
		if location != expectedLocation {
			t.Errorf("Expected Location header %q, got %q", expectedLocation, location)
		}

		// Create a test request with valid state but no code
		req = httptest.NewRequest("GET", "/auth/callback?state="+state, nil)
		w = httptest.NewRecorder()
		oidc.callbackHandler(w, req)
		resp = w.Result()
		if resp.StatusCode != http.StatusFound {
			t.Errorf("Expected status %d, got %d", http.StatusFound, resp.StatusCode)
			return
		}

		location = resp.Header.Get("Location")
		expectedLocation = "/login?error=token_exchange_failed&error_description=Failed+to+exchange+code+for+token"
		if location != expectedLocation {
			t.Errorf("Expected Location header %q, got %q", expectedLocation, location)
		}
	})

	t.Run("LogoutHandler", func(t *testing.T) {
		// Create a test request
		req := httptest.NewRequest("GET", "/auth/logout", nil)
		w := httptest.NewRecorder()

		// Call the handler
		oidc.logoutHandler(w, req)

		// Check the response
		resp := w.Result()
		if resp.StatusCode != http.StatusFound {
			t.Errorf("Expected status %d, got %d", http.StatusFound, resp.StatusCode)
		}

		// Verify the cookie is cleared
		cookies := resp.Cookies()
		if len(cookies) != 1 {
			t.Errorf("Expected 1 cookie, got %d", len(cookies))
		}
		cookie := cookies[0]
		if cookie.Name != sessionCookieName {
			t.Errorf("Expected cookie name %s, got %s", sessionCookieName, cookie.Name)
		}
		if cookie.Value != "" {
			t.Error("Expected empty cookie value")
		}
		if cookie.MaxAge != -1 {
			t.Errorf("Expected MaxAge -1, got %d", cookie.MaxAge)
		}
	})
}

func TestOIDC_DownloadJWKS(t *testing.T) {
	// Create a test server to mock the JWKS endpoint
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Create a test RSA key
		key := &rsa.PublicKey{
			N: big.NewInt(12345),
			E: 65537,
		}

		// Create a test JWKS response
		jwks := &jwks{
			Keys: []jwksKey{
				{
					Kty: "RSA",
					Alg: "RS256",
					Use: "sig",
					Kid: "test-key",
					N:   base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
					E:   base64.RawURLEncoding.EncodeToString([]byte{1, 0, 1}),
				},
			},
		}

		if err := json.NewEncoder(w).Encode(jwks); err != nil {
			http.Error(w, "failed to encode response", http.StatusInternalServerError)
			return
		}
	}))
	defer ts.Close()

	// Create a test OIDC instance
	cfg := &config.OIDCConfig{
		Google: &config.GoogleOIDCConfig{
			ClientCredentialsFile: "testdata/google-client-dummy.json",
			DiscoveryURL: "https://accounts.google.com/.well-known/openid-configuration",
		},
	}
	oidc, err := newOIDC(cfg)
	if err != nil {
		t.Fatalf("Failed to create OIDC instance: %v", err)
	}

	// Override the discovery document with our test server URL
	oidc.discovery.JWKSURI = ts.URL

	// Download the JWKS
	err = oidc.downloadJWKS()
	if err != nil {
		t.Fatalf("Failed to download JWKS: %v", err)
	}

	// Verify the public key was stored
	if oidc.publicKeys["test-key"] == nil {
		t.Error("Public key was not stored")
	}
}

func TestOIDC_VerifyToken(t *testing.T) {
	// Create a test RSA key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("Failed to generate RSA key: %v", err)
	}

	// Create a test OIDC instance
	cfg := &config.OIDCConfig{
		Google: &config.GoogleOIDCConfig{
			ClientCredentialsFile: "testdata/google-client-dummy.json",
			DiscoveryURL:          "https://accounts.google.com/.well-known/openid-configuration",
		},
		Domains: []string{"example.com"},
	}
	oidc, err := newOIDC(cfg)
	if err != nil {
		t.Fatalf("Failed to create OIDC instance: %v", err)
	}

	// Store the public key
	oidc.publicKeys["test-key"] = &privateKey.PublicKey

	// Create a valid token
	claims := jwt.MapClaims{
		"iss": "https://accounts.google.com",
		"aud": "dummy-client-id",
		"exp": time.Now().Add(time.Hour).Unix(),
		"hd":  "example.com",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"
	signedToken, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("Failed to sign token: %v", err)
	}

	// Verify the token
	valid, err := oidc.verifyToken(signedToken)
	if err != nil {
		t.Errorf("Unexpected error verifying valid token: %v", err)
	}
	if !valid {
		t.Error("Valid token was not accepted")
	}

	// Test with invalid token
	valid, err = oidc.verifyToken("invalid-token")
	if err == nil {
		t.Error("Expected error with invalid token")
	}
	if valid {
		t.Error("Invalid token was accepted")
	}

  // Test with unknown domain
	claims["hd"] = "unknown.com"
	token = jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"
	signedToken, err = token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("Failed to sign token: %v", err)
	}

	valid, err = oidc.verifyToken(signedToken)
	if err == nil || err.Error() != "hosted domain unknown.com not in allowed domains" {
		t.Errorf("Expected error 'hosted domain unknown.com not in allowed domains', got: %v", err)
	}
	if valid {
		t.Error("Invalid token was accepted")
	}

	// Test with expired token
	claims["exp"] = time.Now().Add(-time.Hour).Unix()
	token = jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"
	expiredToken, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("Failed to sign expired token: %v", err)
	}

	valid, err = oidc.verifyToken(expiredToken)
	if err == nil {
		t.Error("Expected error with expired token")
	}
	if valid {
		t.Error("Expired token was accepted")
	}
}

func TestOIDCProvider_Google(t *testing.T) {
	// Create a test Google provider
	cfg := &config.GoogleOIDCConfig{
		ClientCredentialsFile: "testdata/google-client-dummy.json",
		DiscoveryURL:          "https://accounts.google.com/.well-known/openid-configuration",
	}
	provider := NewGoogleProvider(cfg)

	t.Run("GetOAuth2Config", func(t *testing.T) {
		config, err := provider.GetOAuth2Config()
		if err != nil {
			t.Fatalf("Failed to get OAuth2 config: %v", err)
		}
		if config == nil {
			t.Error("Expected non-nil OAuth2 config")
		}
	})

	t.Run("GetDiscoveryURL", func(t *testing.T) {
		url := provider.GetDiscoveryURL()
		if url != cfg.GetDiscoveryURL() {
			t.Errorf("Expected discovery URL %s, got %s", cfg.GetDiscoveryURL(), url)
		}
	})

	t.Run("ValidateDomainClaims", func(t *testing.T) {
		// Test valid domain
		claims := jwt.MapClaims{
			"hd": "example.com",
		}
		err := provider.ValidateDomainClaims(claims, []string{"example.com"})
		if err != nil {
			t.Errorf("Expected no error for valid domain, got %v", err)
		}

		// Test invalid domain
		err = provider.ValidateDomainClaims(claims, []string{"other.com"})
		if err == nil {
			t.Error("Expected error for invalid domain")
		}

		// Test missing hosted domain
		claims = jwt.MapClaims{}
		err = provider.ValidateDomainClaims(claims, []string{"example.com"})
		if err == nil {
			t.Error("Expected error for missing hosted domain")
		}

		// Test empty hosted domain
		claims = jwt.MapClaims{"hd": ""}
		err = provider.ValidateDomainClaims(claims, []string{"example.com"})
		if err == nil {
			t.Error("Expected error for empty hosted domain")
		}
	})
}

func TestOIDCProvider_Generic(t *testing.T) {
	// Create a test Generic provider
	cfg := &config.GenericOIDCConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		RedirectURL:  "http://localhost:8080/auth/callback",
		Scopes:       []string{"openid", "email"},
		DiscoveryURL: "https://auth.example.com/.well-known/openid-configuration",
	}
	provider := NewGenericProvider(cfg)

	t.Run("GetOAuth2Config", func(t *testing.T) {
		config, err := provider.GetOAuth2Config()
		if err != nil {
			t.Fatalf("Failed to get OAuth2 config: %v", err)
		}
		if config == nil {
			t.Error("Expected non-nil OAuth2 config")
		}
		if config != nil && config.ClientID != cfg.ClientID {
			t.Errorf("Expected client ID %s, got %s", cfg.ClientID, config.ClientID)
		}
		if config != nil && config.ClientSecret != cfg.ClientSecret {
			t.Errorf("Expected client secret %s, got %s", cfg.ClientSecret, config.ClientSecret)
		}
	})

	t.Run("GetDiscoveryURL", func(t *testing.T) {
		url := provider.GetDiscoveryURL()
		if url != cfg.GetDiscoveryURL() {
			t.Errorf("Expected discovery URL %s, got %s", cfg.GetDiscoveryURL(), url)
		}
	})

	t.Run("ValidateDomainClaims", func(t *testing.T) {
		// Test valid email domain
		claims := jwt.MapClaims{
			"email": "user@example.com",
		}
		err := provider.ValidateDomainClaims(claims, []string{"example.com"})
		if err != nil {
			t.Errorf("Expected no error for valid email domain, got %v", err)
		}

		// Test invalid email domain
		err = provider.ValidateDomainClaims(claims, []string{"other.com"})
		if err == nil {
			t.Error("Expected error for invalid email domain")
		}

		// Test missing email
		claims = jwt.MapClaims{}
		err = provider.ValidateDomainClaims(claims, []string{"example.com"})
		if err == nil {
			t.Error("Expected error for missing email")
		}

		// Test empty email
		claims = jwt.MapClaims{"email": ""}
		err = provider.ValidateDomainClaims(claims, []string{"example.com"})
		if err == nil {
			t.Error("Expected error for empty email")
		}

		// Test invalid email format
		claims = jwt.MapClaims{"email": "invalid-email"}
		err = provider.ValidateDomainClaims(claims, []string{"example.com"})
		if err == nil {
			t.Error("Expected error for invalid email format")
		}
	})
}

func TestOIDC_ProviderSelection(t *testing.T) {
	t.Run("Google Provider", func(t *testing.T) {
		cfg := &config.OIDCConfig{
			Google: &config.GoogleOIDCConfig{
				ClientCredentialsFile: "testdata/google-client-dummy.json",
				DiscoveryURL:          "https://accounts.google.com/.well-known/openid-configuration",
			},
		}
		oidc, err := newOIDC(cfg)
		if err != nil {
			t.Fatalf("Failed to create OIDC instance: %v", err)
		}
		if _, ok := oidc.provider.(*GoogleProvider); !ok {
			t.Error("Expected GoogleProvider, got different provider type")
		}
	})

	t.Run("Generic Provider", func(t *testing.T) {
		cfg := &config.OIDCConfig{
			Generic: &config.GenericOIDCConfig{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				RedirectURL:  "http://localhost:8080/auth/callback",
				Scopes:       []string{"openid", "email"},
				DiscoveryURL: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
			},
		}
		oidc, err := newOIDC(cfg)
		if err != nil {
			t.Fatalf("Failed to create OIDC instance: %v", err)
		}
		if _, ok := oidc.provider.(*GenericProvider); !ok {
			t.Error("Expected GenericProvider, got different provider type")
		}
	})

	t.Run("Both Providers Configured", func(t *testing.T) {
		cfg := &config.OIDCConfig{
			Google: &config.GoogleOIDCConfig{
				ClientCredentialsFile: "testdata/google-client-dummy.json",
				DiscoveryURL:          "https://accounts.google.com/.well-known/openid-configuration",
			},
			Generic: &config.GenericOIDCConfig{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				RedirectURL:  "http://localhost:8080/auth/callback",
				Scopes:       []string{"openid", "email"},
				DiscoveryURL: "https://auth.example.com/.well-known/openid-configuration",
			},
		}
		_, err := newOIDC(cfg)
		if err == nil {
			t.Error("Expected error when both providers are configured")
		}
	})
}

func TestOIDC_UnauthenticatedRoutes(t *testing.T) {
	// Create test OIDC config
	oidcConfig := &config.OIDCConfig{
		Google: &config.GoogleOIDCConfig{
			ClientCredentialsFile: "testdata/google-client-dummy.json",
			DiscoveryURL:          "https://accounts.google.com/.well-known/openid-configuration",
		},
	}

	// Create server config
	serverConfig := &config.AssistantServerConfig{
		CorsOrigins: []string{"http://localhost:3000"},
		OIDC: oidcConfig,
	}

	// Create auth mux
	mux, err := NewAuthMux(serverConfig)
	if err != nil {
		t.Fatalf("Failed to create auth mux: %v", err)
	}

	// Register auth routes
	if err := RegisterAuthRoutes(oidcConfig, mux); err != nil {
		t.Fatalf("Failed to register auth routes: %v", err)
	}

	// Register test routes
	mux.Handle("/public", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	mux.HandleProtected("/protected", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Test public route
	req := httptest.NewRequest("GET", "/public", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, rec.Code)
	}

	// Test protected route
	req = httptest.NewRequest("GET", "/protected", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, rec.Code)
	}
	resp := rec.Result()
	if location := resp.Header.Get("Location"); location != "/oidc/login" {
		t.Errorf("Expected redirect to /oidc/login, got %s", location)
	}
}
