package iam

import (
	"strings"

	"github.com/jlewi/cloud-assistant/app/api"
	"github.com/pkg/errors"
)

type Checker interface {
	Check(principal string, role string) bool
}

// PolicyChecker enforces IAMPolicies. It checks if a user has the required permissions to perform an action.
type PolicyChecker struct {
	policy api.IAMPolicy

	// Create a map from roles to members
	roles map[string]map[string]bool
}

// NewChecker creates a new IAM policy checker.
func NewChecker(policy api.IAMPolicy) (*PolicyChecker, error) {
	// Validate the policy
	if isValid, msg := IsValidPolicy(policy); !isValid {
		return nil, errors.New(msg)
	}

	c := &PolicyChecker{
		policy: policy,
		roles:  make(map[string]map[string]bool),
	}

	// Cache the roles
	for _, binding := range policy.Bindings {
		if _, ok := c.roles[binding.Role]; !ok {
			c.roles[binding.Role] = make(map[string]bool)
		}

		for _, member := range binding.Members {
			c.roles[binding.Role][member.Name] = true
		}
	}

	return c, nil
}

// Check returns true if and only if the principal has the given role in the IAM policy.
func (c *PolicyChecker) Check(principal string, role string) bool {
	members, ok := c.roles[role]
	if !ok {
		return false
	}

	if _, ok := members[principal]; ok {
		return true
	} else {
		return false
	}
}

// IsValidPolicy checks if the IAM policy is valid. If its not it returns a string with a human readable
// message about the violations
func IsValidPolicy(policy api.IAMPolicy) (bool, string) {

	allowedRoles := map[string]bool{api.RunnerUserRole: true, api.AgentUserRole: true}
	roleNames := []string{api.RunnerUserRole, api.AgentUserRole}
	violations := func() []string {
		violations := make([]string, 0, 10)
		// Check if the policy is valid
		if len(policy.Bindings) == 0 {
			violations = append(violations, "policy must have at least one binding")
			return violations
		}

		for _, binding := range policy.Bindings {
			if len(binding.Members) == 0 {
				violations = append(violations, "binding must have at least one member")
			}

			if binding.Role == "" {
				violations = append(violations, "binding must have a role")
			}

			if _, ok := allowedRoles[binding.Role]; !ok {
				violations = append(violations, "binding role must be one of: %s", strings.Join(roleNames, ","))
			}
		}

		return violations
	}()

	message := ""
	if len(violations) > 0 {
		message = "IAM policy is invalid. Violations: " + strings.Join(violations, ", ")
		return false, message
	}

	return true, message
}

// AllowAllChecker is a no auth checker that allows all requests.
type AllowAllChecker struct {
}

func (c *AllowAllChecker) Check(principal string, role string) bool {
	return true
}
