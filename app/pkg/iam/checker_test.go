package iam

import (
	"testing"

	"github.com/jlewi/cloud-assistant/app/api"
)

func TestChecker_Check(t *testing.T) {
	testCases := []struct {
		name      string
		principal string
		role      string
		policy    api.IAMPolicy
		expected  bool
	}{
		{
			name:      "User has role",
			principal: "user1",
			role:      api.RunnerUserRole,
			policy: api.IAMPolicy{
				Bindings: []api.IAMBinding{
					{
						Role: api.RunnerUserRole,
						Members: []api.Member{
							{Name: "user1"},
						},
					},
				},
			},
			expected: true,
		},
		{
			name:      "User doesn't have role",
			principal: "user2",
			role:      api.RunnerUserRole,
			policy: api.IAMPolicy{
				Bindings: []api.IAMBinding{
					{
						Role: api.RunnerUserRole,
						Members: []api.Member{
							{Name: "user1"},
						},
					},
				},
			},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			checker, err := NewChecker(tc.policy)
			if err != nil {
				t.Fatalf("failed to create checker: %v", err)
			}

			result := checker.Check(tc.principal, tc.role)
			if result != tc.expected {
				t.Errorf("expected %v, got %v", tc.expected, result)
			}
		})
	}
}
