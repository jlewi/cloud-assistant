package server

import (
	"context"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pkg/errors"
)

// getIDToken retrieves the ID token from the context if there is one or nil
func getIDToken(ctx context.Context) (*jwt.Token, error) {
	idToken := ctx.Value(IDTokenKey)
	if idToken == nil {
		return nil, errors.New("No ID token")
	}
	token, ok := idToken.(*jwt.Token)
	if !ok {
		return nil, errors.New("ID token is not of type *jwt.Token")
	}
	return token, nil
}

// contextWithIDToken adds the IDToken to the context
func contextWithIDToken(ctx context.Context, idToken *jwt.Token) context.Context {
	return context.WithValue(ctx, IDTokenKey, idToken)
}
