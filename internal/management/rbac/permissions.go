package rbac

import "fmt"

// PermissionDeniedError should be translated to HTTP 403 without disclosing
// private target ownership or secret data.
type PermissionDeniedError struct {
	Resource string
	Action   string
	Reason   string
}

func (e *PermissionDeniedError) Error() string {
	if e.Reason != "" {
		return fmt.Sprintf("permission denied: %s.%s (%s)", e.Resource, e.Action, e.Reason)
	}
	return fmt.Sprintf("permission denied: %s.%s", e.Resource, e.Action)
}

func denied(resource, action, reason string) error {
	return &PermissionDeniedError{Resource: resource, Action: action, Reason: reason}
}

func isReadAction(action string) bool {
	switch action {
	case ActionRead, ActionReadSimple, ActionReadGeneral, ActionLogs, ActionStats:
		return true
	default:
		return false
	}
}

// CheckPermission evaluates one action and defaults to deny for any missing role,
// resource or action. Scope enforcement for a single target is separate.
func CheckPermission(admin *Admin, resource, action string) error {
	if admin == nil {
		return denied(resource, action, "missing administrator")
	}
	if admin.Status == AdminDisabled {
		return denied(resource, action, "administrator disabled")
	}
	if admin.Status != AdminActive && admin.Status != AdminLimited {
		return denied(resource, action, "invalid administrator status")
	}
	// Limited status is enforced even if a caller accidentally attaches an
	// Owner role. Disabled accounts were already rejected above.
	if admin.Status == AdminLimited {
		if admin.Role != nil && admin.Role.DisabledWhenLimited {
			return denied(resource, action, "all access blocked while limited")
		}
		if !isReadAction(action) {
			return denied(resource, action, "write actions blocked while limited")
		}
	}
	if admin.IsOwner() {
		return nil
	}
	if admin.Role == nil {
		return denied(resource, action, "missing role")
	}
	actions, exists := admin.Role.Permissions[resource]
	if !exists {
		return denied(resource, action, "resource not granted")
	}
	grant, exists := actions[action]
	if !exists || !grant.Allowed || grant.Scope == ScopeNone {
		return denied(resource, action, "action not granted")
	}
	if !grant.Scope.Valid() {
		return denied(resource, action, "invalid permission scope")
	}
	return nil
}

// CheckTargetPermission is required for single-record reads and mutations.
func CheckTargetPermission(admin *Admin, resource, action string, targetOwnerID *int64) error {
	if err := CheckPermission(admin, resource, action); err != nil {
		return err
	}
	if admin.IsOwner() {
		return nil
	}
	grant := admin.Role.Permissions[resource][action]
	if grant.Scope != ScopeOwn {
		return nil
	}
	switch resource {
	case ResourceUsers, ResourceClients:
		if targetOwnerID == nil || *targetOwnerID != admin.ID {
			return denied(resource, action, "outside administrator ownership")
		}
		return nil
	default:
		// A grant must never become global just because a resource's ownership
		// resolver has not been implemented yet.
		return denied(resource, action, "OWN scope unsupported for this resource")
	}
}

// OwnerScope is a mandatory query constraint for list endpoints. When Restricted
// is true, the caller MUST filter the database query by AdminID.
type OwnerScope struct {
	Restricted bool
	AdminID    int64
}

func ListOwnerScope(admin *Admin, resource, action string) (OwnerScope, error) {
	if err := CheckPermission(admin, resource, action); err != nil {
		return OwnerScope{}, err
	}
	if admin.IsOwner() {
		return OwnerScope{}, nil
	}
	grant := admin.Role.Permissions[resource][action]
	if grant.Scope != ScopeOwn {
		return OwnerScope{}, nil
	}
	switch resource {
	case ResourceUsers, ResourceClients:
		return OwnerScope{Restricted: true, AdminID: admin.ID}, nil
	default:
		return OwnerScope{}, denied(resource, action, "OWN scope unsupported for this resource")
	}
}

// ValidateLimitOverrides prevents per-admin settings from widening a role's
// policy. Non-nil overrides may tighten a policy or add a limit where the role
// leaves a value unlimited, but must not weaken an inherited bound.
func ValidateLimitOverrides(roleLimits, overrides RoleLimits) error {
	checks := []struct {
		name string
		base, override *int64
		limit string
	}{
		{"max_users", roleLimits.MaxUsers, overrides.MaxUsers, "max"},
		{"data_limit_min", roleLimits.DataLimitMin, overrides.DataLimitMin, "min"},
		{"data_limit_max", roleLimits.DataLimitMax, overrides.DataLimitMax, "max"},
		{"expire_min", roleLimits.ExpireMin, overrides.ExpireMin, "min"},
		{"expire_max", roleLimits.ExpireMax, overrides.ExpireMax, "max"},
		{"min_hwid_per_user", roleLimits.MinHWIDPerUser, overrides.MinHWIDPerUser, "min"},
		{"max_hwid_per_user", roleLimits.MaxHWIDPerUser, overrides.MaxHWIDPerUser, "max"},
		{"on_hold_timeout_min", roleLimits.OnHoldTimeoutMin, overrides.OnHoldTimeoutMin, "min"},
		{"on_hold_timeout_max", roleLimits.OnHoldTimeoutMax, overrides.OnHoldTimeoutMax, "max"},
	}
	for _, item := range checks {
		if item.base == nil || item.override == nil {
			continue
		}
		if item.limit == "max" && *item.override > *item.base {
			return fmt.Errorf("%s override cannot exceed the role maximum", item.name)
		}
		if item.limit == "min" && *item.override < *item.base {
			return fmt.Errorf("%s override cannot be below the role minimum", item.name)
		}
	}
	effective := EffectiveLimits(roleLimits, overrides)
	if err := effective.Validate(); err != nil {
		return fmt.Errorf("invalid effective limits: %w", err)
	}
	return nil
}

// EffectiveLimits overlays non-nil per-admin values on role defaults and does
// not alias or mutate the input structs.
func EffectiveLimits(roleLimits, overrides RoleLimits) RoleLimits {
	result := cloneLimits(roleLimits)
	overrideLimits := cloneLimits(overrides)
	if overrideLimits.MaxUsers != nil {
		result.MaxUsers = overrideLimits.MaxUsers
	}
	if overrideLimits.DataLimitMin != nil {
		result.DataLimitMin = overrideLimits.DataLimitMin
	}
	if overrideLimits.DataLimitMax != nil {
		result.DataLimitMax = overrideLimits.DataLimitMax
	}
	if overrideLimits.ExpireMin != nil {
		result.ExpireMin = overrideLimits.ExpireMin
	}
	if overrideLimits.ExpireMax != nil {
		result.ExpireMax = overrideLimits.ExpireMax
	}
	if overrideLimits.MinHWIDPerUser != nil {
		result.MinHWIDPerUser = overrideLimits.MinHWIDPerUser
	}
	if overrideLimits.MaxHWIDPerUser != nil {
		result.MaxHWIDPerUser = overrideLimits.MaxHWIDPerUser
	}
	if overrideLimits.OnHoldTimeoutMin != nil {
		result.OnHoldTimeoutMin = overrideLimits.OnHoldTimeoutMin
	}
	if overrideLimits.OnHoldTimeoutMax != nil {
		result.OnHoldTimeoutMax = overrideLimits.OnHoldTimeoutMax
	}
	return result
}

func cloneLimits(v RoleLimits) RoleLimits {
	return RoleLimits{
		MaxUsers: cloneInt64(v.MaxUsers), DataLimitMin: cloneInt64(v.DataLimitMin), DataLimitMax: cloneInt64(v.DataLimitMax),
		ExpireMin: cloneInt64(v.ExpireMin), ExpireMax: cloneInt64(v.ExpireMax),
		MinHWIDPerUser: cloneInt64(v.MinHWIDPerUser), MaxHWIDPerUser: cloneInt64(v.MaxHWIDPerUser),
		OnHoldTimeoutMin: cloneInt64(v.OnHoldTimeoutMin), OnHoldTimeoutMax: cloneInt64(v.OnHoldTimeoutMax),
	}
}

func cloneInt64(v *int64) *int64 {
	if v == nil {
		return nil
	}
	copied := *v
	return &copied
}
