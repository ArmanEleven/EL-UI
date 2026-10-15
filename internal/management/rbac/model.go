// Package rbac defines the independent management-plane role model.
package rbac

import (
	"fmt"
	"strings"
)

const (
	ResourceUsers           = "users"
	ResourceAdmins          = "admins"
	ResourceNodes           = "nodes"
	ResourceGroups          = "groups"
	ResourceHosts           = "hosts"
	ResourceTemplates       = "templates"
	ResourceClientTemplates = "client_templates"
	ResourceCores           = "cores"
	ResourceSettings        = "settings"
	ResourceSystem          = "system"
	ResourceHWIDs           = "hwids"
	ResourceAdminRoles      = "admin_roles"
	ResourceAPIKeys         = "api_keys"
)

const (
	ActionCreate           = "create"
	ActionRead             = "read"
	ActionReadSimple       = "read_simple"
	ActionReadGeneral      = "read_general"
	ActionUpdate           = "update"
	ActionDelete           = "delete"
	ActionResetUsage       = "reset_usage"
	ActionRevokeSub        = "revoke_sub"
	ActionSetOwner         = "set_owner"
	ActionActivateNextPlan = "activate_next_plan"
	ActionReconnect        = "reconnect"
	ActionUpdateCore       = "update_core"
	ActionLogs             = "logs"
	ActionStats            = "stats"
)

// PermissionScope preserves the PasarGuard numeric scope contract.
type PermissionScope uint8

const (
	ScopeNone PermissionScope = iota
	ScopeOwn
	ScopeAll
)

func (s PermissionScope) Valid() bool { return s == ScopeNone || s == ScopeOwn || s == ScopeAll }

type ActionPermission struct {
	Allowed bool            `json:"allowed"`
	Scope   PermissionScope `json:"scope"`
}

func AllowOwn() ActionPermission { return ActionPermission{Allowed: true, Scope: ScopeOwn} }
func AllowAll() ActionPermission { return ActionPermission{Allowed: true, Scope: ScopeAll} }
func Deny() ActionPermission     { return ActionPermission{Allowed: false, Scope: ScopeNone} }

type Permissions map[string]map[string]ActionPermission

type RoleLimits struct {
	MaxUsers         *int64 `json:"max_users,omitempty"`
	DataLimitMin     *int64 `json:"data_limit_min,omitempty"`
	DataLimitMax     *int64 `json:"data_limit_max,omitempty"`
	ExpireMin        *int64 `json:"expire_min,omitempty"`
	ExpireMax        *int64 `json:"expire_max,omitempty"`
	MinHWIDPerUser   *int64 `json:"min_hwid_per_user,omitempty"`
	MaxHWIDPerUser   *int64 `json:"max_hwid_per_user,omitempty"`
	OnHoldTimeoutMin *int64 `json:"on_hold_timeout_min,omitempty"`
	OnHoldTimeoutMax *int64 `json:"on_hold_timeout_max,omitempty"`
}

func (l RoleLimits) Validate() error {
	values := []struct {
		name string
		value *int64
	}{
		{"max_users", l.MaxUsers}, {"data_limit_min", l.DataLimitMin},
		{"data_limit_max", l.DataLimitMax}, {"expire_min", l.ExpireMin},
		{"expire_max", l.ExpireMax}, {"min_hwid_per_user", l.MinHWIDPerUser},
		{"max_hwid_per_user", l.MaxHWIDPerUser}, {"on_hold_timeout_min", l.OnHoldTimeoutMin},
		{"on_hold_timeout_max", l.OnHoldTimeoutMax},
	}
	for _, item := range values {
		if item.value != nil && *item.value < 0 {
			return fmt.Errorf("%s must be non-negative", item.name)
		}
	}
	for _, bounds := range []struct {
		name string
		min, max *int64
	}{
		{"data_limit", l.DataLimitMin, l.DataLimitMax},
		{"expire", l.ExpireMin, l.ExpireMax},
		{"hwid_per_user", l.MinHWIDPerUser, l.MaxHWIDPerUser},
		{"on_hold_timeout", l.OnHoldTimeoutMin, l.OnHoldTimeoutMax},
	} {
		if bounds.min != nil && bounds.max != nil && *bounds.min > *bounds.max {
			return fmt.Errorf("%s minimum cannot exceed maximum", bounds.name)
		}
	}
	return nil
}

type RoleFeatures struct {
	CanUseResetStrategy bool `json:"can_use_reset_strategy"`
	CanUseNextPlan      bool `json:"can_use_next_plan"`
}

type RoleAccess struct {
	RequireTemplate    bool    `json:"require_template"`
	AllowedTemplateIDs []int64 `json:"allowed_template_ids"`
	AllowedGroupIDs    []int64 `json:"allowed_group_ids"`
}

func (a RoleAccess) AllowsGroup(id int64) bool    { return containsAllowedID(a.AllowedGroupIDs, id) }
func (a RoleAccess) AllowsTemplate(id int64) bool { return containsAllowedID(a.AllowedTemplateIDs, id) }

func containsAllowedID(allowed []int64, id int64) bool {
	if allowed == nil {
		return true
	}
	for _, candidate := range allowed {
		if candidate == id {
			return true
		}
	}
	return false
}

func (a RoleAccess) FilterGroupIDs(requested []int64) []int64 {
	return intersectIDs(requested, a.AllowedGroupIDs)
}
func (a RoleAccess) FilterTemplateIDs(requested []int64) []int64 {
	return intersectIDs(requested, a.AllowedTemplateIDs)
}

func intersectIDs(requested, allowed []int64) []int64 {
	if allowed == nil {
		return copyIDs(requested)
	}
	if requested == nil {
		return copyIDs(allowed)
	}
	allowedSet := make(map[int64]struct{}, len(allowed))
	for _, id := range allowed {
		allowedSet[id] = struct{}{}
	}
	result := make([]int64, 0, len(requested))
	seen := make(map[int64]struct{}, len(requested))
	for _, id := range requested {
		if _, ok := allowedSet[id]; !ok {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func copyIDs(ids []int64) []int64 {
	if ids == nil {
		return nil
	}
	out := make([]int64, len(ids))
	copy(out, ids)
	return out
}

type HWIDMode string

const (
	HWIDDisabled  HWIDMode = "disabled"
	HWIDUseGlobal HWIDMode = "use_global"
	HWIDOverride  HWIDMode = "override"
)

type RoleHWIDSettings struct {
	Mode HWIDMode `json:"mode"`
}

type Role struct {
	Name                        string             `json:"name"`
	IsOwner                     bool               `json:"is_owner"`
	Permissions                 Permissions        `json:"permissions"`
	Limits                      RoleLimits         `json:"limits"`
	Features                    RoleFeatures       `json:"features"`
	Access                      RoleAccess         `json:"access"`
	HWID                        RoleHWIDSettings   `json:"hwid"`
	DisabledWhenLimited         bool               `json:"disabled_when_limited"`
	DisconnectUsersWhenLimited  bool               `json:"disconnect_users_when_limited"`
	DisconnectUsersWhenDisabled bool               `json:"disconnect_users_when_disabled"`
}

// NewRole applies the reference role-creation defaults.
func NewRole(name string) Role {
	return Role{
		Name: name,
		Permissions: make(Permissions),
		Features: RoleFeatures{CanUseResetStrategy: true, CanUseNextPlan: true},
		HWID: RoleHWIDSettings{Mode: HWIDUseGlobal},
		DisconnectUsersWhenLimited: true,
		DisconnectUsersWhenDisabled: true,
	}
}

func (r Role) Validate() error {
	if strings.TrimSpace(r.Name) == "" {
		return fmt.Errorf("role name cannot be empty")
	}
	if len([]rune(r.Name)) > 64 {
		return fmt.Errorf("role name cannot exceed 64 characters")
	}
	if err := r.Limits.Validate(); err != nil {
		return err
	}
	if r.HWID.Mode != "" && r.HWID.Mode != HWIDDisabled && r.HWID.Mode != HWIDUseGlobal && r.HWID.Mode != HWIDOverride {
		return fmt.Errorf("unsupported HWID mode %q", r.HWID.Mode)
	}
	for resource, actions := range r.Permissions {
		if strings.TrimSpace(resource) == "" {
			return fmt.Errorf("permission resource cannot be empty")
		}
		for action, grant := range actions {
			if strings.TrimSpace(action) == "" {
				return fmt.Errorf("permission action for resource %q cannot be empty", resource)
			}
			if !grant.Scope.Valid() {
				return fmt.Errorf("invalid permission scope %d for %s.%s", grant.Scope, resource, action)
			}
		}
	}
	return nil
}

type AdminStatus string

const (
	AdminActive AdminStatus = "active"
	AdminDisabled AdminStatus = "disabled"
	AdminLimited AdminStatus = "limited"
)

// Admin is an authorization context; it does not replace the native 3X-UI user model.
type Admin struct {
	ID                  int64       `json:"id"`
	Status              AdminStatus `json:"status"`
	Role                *Role       `json:"role,omitempty"`
	PermissionOverrides RoleLimits  `json:"permission_overrides"`
}

func (a *Admin) IsOwner() bool { return a != nil && a.Role != nil && a.Role.IsOwner }

func (a *Admin) Validate() error {
	if a == nil {
		return fmt.Errorf("admin is required")
	}
	switch a.Status {
	case AdminActive, AdminDisabled, AdminLimited:
	default:
		return fmt.Errorf("unsupported admin status %q", a.Status)
	}
	if a.ID <= 0 && !a.IsOwner() {
		return fmt.Errorf("non-owner admin ID must be positive")
	}
	return a.PermissionOverrides.Validate()
}
