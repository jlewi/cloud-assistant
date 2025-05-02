package iam

import (
	"testing"
)

func TestDomainMatcher_Check(t *testing.T) {
	tests := []struct {
		domain    string
		principal string
		want      bool
	}{
		{
			domain:    "example.com",
			principal: "user@example.com",
			want:      true,
		},
		{
			domain:    "example.org",
			principal: "user@example.com",
			want:      false,
		},
		{
			domain:    "example.com",
			principal: "user@sub.example.com",
			want:      false,
		},
		{
			domain:    "example.com",
			principal: "invalid-email",
			want:      false,
		},
		{
			domain:    "example.com",
			principal: "another@example.com",
			want:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.principal, func(t *testing.T) {
			matcher := &domainMatcher{domain: tt.domain}
			if got := matcher.Check(tt.principal); got != tt.want {
				t.Errorf("domainMatcher.Check() = %v, want %v", got, tt.want)
			}
		})
	}
}
