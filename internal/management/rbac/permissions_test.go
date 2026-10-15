package rbac

import (
	"errors"
	"testing"
)

func ptr(v int64) *int64 { return &v }

func adminWith(status AdminStatus, perms Permissions) *Admin {
	return &Admin{ID: 7, Status: status, Role: &Role{Name: "operator", Permissions: perms}}
}

func TestCheckPermissionDefaultsToDeny(t *testing.T) {
	admin := adminWith(AdminActive, nil)
	if err := CheckPermission(admin, ResourceUsers, ActionRead); err == nil {
		t.Fatal("missing resource/action must be denied")
	}
	if err := CheckPermission(nil, ResourceUsers, ActionRead); err == nil {
		t.Fatal("missing administrator must be denied")
	}
}

func TestOwnerBypassesRoleGrantsButDisabledAccountIsDenied(t *testing.T) {
	admin := adminWith(AdminActive, nil)
	admin.Role.IsOwner = true
	if err := CheckPermission(admin, ResourceSettings, ActionUpdate); err != nil {
		t.Fatalf("owner should have full access: %v", err)
	}
	admin.Status = AdminDisabled
	if err := CheckPermission(admin, ResourceSettings, ActionUpdate); err == nil {
		t.Fatal("disabled account must not be authorized")
	}
}

func TestOwnScopeChecksTargetOwnership(t *testing.T) {
	admin := adminWith(AdminActive, Permissions{ResourceUsers: {ActionRead: AllowOwn(), ActionUpdate: AllowOwn()}})
	ownID, otherID := int64(7), int64(8)
	if err := CheckTargetPermission(admin, ResourceUsers, ActionRead, &ownID); err != nil {
		t.Fatalf("own record should be accessible: %v", err)
	}
	if err := CheckTargetPermission(admin, ResourceUsers, ActionUpdate, &otherID); err == nil {
		t.Fatal("other administrator's record must be denied")
	}
	if err := CheckTargetPermission(admin, ResourceUsers, ActionRead, nil); err == nil {
		t.Fatal("OWN target check must fail closed when owner ID is unknown")
	}
}

func TestAllScopeAllowsOtherOwner(t *testing.T) {
	admin := adminWith(AdminActive, Permissions{ResourceUsers: {ActionRead: AllowAll()}})
	otherID := int64(900)
	if err := CheckTargetPermission(admin, ResourceUsers, ActionRead, &otherID); err != nil {
		t.Fatalf("ALL scope should allow target: %v", err)
	}
}

func TestExplicitNoneIsDenied(t *testing.T) {
	admin := adminWith(AdminActive, Permissions{ResourceUsers: {ActionRead: {Allowed: true, Scope: ScopeNone}}})
	if err := CheckPermission(admin, ResourceUsers, ActionRead); err == nil {
		t.Fatal("explicit NONE scope must be denied")
	}
}

func TestLimitedAdminCanOnlyReadUnlessRoleDisablesAllAccess(t *testing.T) {
	admin := adminWith(AdminLimited, Permissions{ResourceUsers: {ActionRead: AllowOwn(), ActionCreate: AllowOwn()}})
	if err := CheckPermission(admin, ResourceUsers, ActionRead); err != nil {
		t.Fatalf("read should remain allowed: %v", err)
	}
	if err := CheckPermission(admin, ResourceUsers, ActionCreate); err == nil {
		t.Fatal("write should be blocked")
	}
	admin.Role.DisabledWhenLimited = true
	if err := CheckPermission(admin, ResourceUsers, ActionRead); err == nil {
		t.Fatal("all access should be blocked when configured")
	}
}

func TestListOwnerScopeUsesAdminFilterForOwn(t *testing.T) {
	admin := adminWith(AdminActive, Permissions{ResourceUsers: {ActionRead: AllowOwn()}})
	scope, err := ListOwnerScope(admin, ResourceUsers, ActionRead)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !scope.Restricted || scope.AdminID != admin.ID {
		t.Fatalf("expected owner filter for %d, got %+v", admin.ID, scope)
	}
	admin.Role.Permissions[ResourceUsers][ActionRead] = AllowAll()
	scope, err = ListOwnerScope(admin, ResourceUsers, ActionRead)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if scope.Restricted {
		t.Fatalf("ALL scope must not apply owner filter: %+v", scope)
	}
}

func TestEffectiveLimitsOverrideOnlySpecifiedValues(t *testing.T) {
	roleLimits := RoleLimits{MaxUsers: ptr(100), DataLimitMin: ptr(1000), DataLimitMax: ptr(10000)}
	overrides := RoleLimits{MaxUsers: ptr(20), DataLimitMax: ptr(5000)}
	effective := EffectiveLimits(roleLimits, overrides)
	if *effective.MaxUsers != 20 {
		t.Fatalf("max users = %d, want 20", *effective.MaxUsers)
	}
	if *effective.DataLimitMin != 1000 {
		t.Fatalf("data min should inherit role value, got %d", *effective.DataLimitMin)
	}
	if *effective.DataLimitMax != 5000 {
		t.Fatalf("data max = %d, want 5000", *effective.DataLimitMax)
	}
	*effective.MaxUsers = 3
	if *overrides.MaxUsers != 20 {
		t.Fatal("effective limits must not alias overrides")
	}
}

func TestAccessAllowListsAndIntersections(t *testing.T) {
	access := RoleAccess{AllowedGroupIDs: []int64{2, 4}, AllowedTemplateIDs: []int64{}}
	if !access.AllowsGroup(2) || access.AllowsGroup(3) {
		t.Fatal("group allow-list was not enforced")
	}
	if access.AllowsTemplate(1) {
		t.Fatal("empty template list should deny every template")
	}
	got := access.FilterGroupIDs([]int64{1, 2, 2, 4, 8})
	if len(got) != 2 || got[0] != 2 || got[1] != 4 {
		t.Fatalf("unexpected filtered group IDs: %v", got)
	}
	if got := access.FilterTemplateIDs(nil); got == nil || len(got) != 0 {
		t.Fatalf("empty allow-list must remain empty, got %#v", got)
	}
	if got := (RoleAccess{}).FilterGroupIDs(nil); got != nil {
		t.Fatalf("nil allow-list should preserve nil, got %#v", got)
	}
}

func TestRoleValidationRejectsInvalidLimitRange(t *testing.T) {
	role := Role{Name: "bad-role", Limits: RoleLimits{DataLimitMin: ptr(10), DataLimitMax: ptr(5)}}
	if err := role.Validate(); err == nil {
		t.Fatal("minimum greater than maximum must fail")
	}
}

func TestPermissionDenialHasStableType(t *testing.T) {
	err := CheckPermission(nil, ResourceUsers, ActionRead)
	var deniedErr *PermissionDeniedError
	if !errors.As(err, &deniedErr) {
		t.Fatalf("expected PermissionDeniedError, got %T", err)
	}
	if deniedErr.Resource != ResourceUsers || deniedErr.Action != ActionRead {
		t.Fatalf("unexpected denial: %+v", deniedErr)
	}
}

func TestNewRoleHasReferenceDefaults(t *testing.T) {
	role := NewRole("operator")
	if !role.Features.CanUseResetStrategy || !role.Features.CanUseNextPlan {
		t.Fatal("role feature defaults should be enabled")
	}
	if role.HWID.Mode != HWIDUseGlobal {
		t.Fatalf("default HWID mode = %q, want %q", role.HWID.Mode, HWIDUseGlobal)
	}
	if !role.DisconnectUsersWhenLimited || !role.DisconnectUsersWhenDisabled {
		t.Fatal("disconnect defaults should be enabled")
	}
}


func TestOwnScopeFailsClosedForUnsupportedResources(t *testing.T) {
	admin := adminWith(AdminActive, Permissions{
		ResourceHosts: {ActionRead: AllowOwn()},
	})
	targetOwner := int64(admin.ID)
	if err := CheckTargetPermission(admin, ResourceHosts, ActionRead, &targetOwner); err == nil {
		t.Fatal("OWN scope on a resource without ownership enforcement must be denied")
	}
	if _, err := ListOwnerScope(admin, ResourceHosts, ActionRead); err == nil {
		t.Fatal("list OWN scope on an unsupported resource must be denied")
	}
}

func TestOwnScopeRestrictsClientOwnership(t *testing.T) {
	admin := adminWith(AdminActive, Permissions{ResourceClients: {ActionRead: AllowOwn()}})
	ownID, otherID := int64(admin.ID), int64(admin.ID + 1)
	if err := CheckTargetPermission(admin, ResourceClients, ActionRead, &ownID); err != nil {
		t.Fatalf("own client should be allowed: %v", err)
	}
	if err := CheckTargetPermission(admin, ResourceClients, ActionRead, &otherID); err == nil {
		t.Fatal("another admin's client must be denied")
	}
}

func TestValidateLimitOverridesCannotExpandRole(t *testing.T) {
	role := RoleLimits{MaxUsers: ptr(20), DataLimitMin: ptr(10), DataLimitMax: ptr(1000)}
	if err := ValidateLimitOverrides(role, RoleLimits{MaxUsers: ptr(21)}); err == nil {
		t.Fatal("max-users override cannot expand role maximum")
	}
	if err := ValidateLimitOverrides(role, RoleLimits{DataLimitMin: ptr(9)}); err == nil {
		t.Fatal("data minimum override cannot relax role minimum")
	}
	if err := ValidateLimitOverrides(role, RoleLimits{DataLimitMax: ptr(1001)}); err == nil {
		t.Fatal("data maximum override cannot expand role maximum")
	}
	if err := ValidateLimitOverrides(role, RoleLimits{MaxUsers: ptr(5), DataLimitMin: ptr(20), DataLimitMax: ptr(500)}); err != nil {
		t.Fatalf("tighter overrides should pass: %v", err)
	}
}

func TestOwnerRoleCannotBeAssignedThroughNormalRolePath(t *testing.T) {
	role := NewRole("owner")
	role.IsOwner = true
	if err := role.ValidateAssignable(); err == nil {
		t.Fatal("owner role must be protected from normal assignment")
	}
}

func TestInboundAllowListRequiresExplicitID(t *testing.T) {
	if (RoleAccess{}).AllowsInbound(1) {
		t.Fatal("empty inbound allow-list must deny")
	}
	access := RoleAccess{AllowedInboundIDs: []int64{2, 4}}
	if !access.AllowsInbound(2) || access.AllowsInbound(3) || access.AllowsInbound(0) {
		t.Fatal("inbound allow-list did not enforce explicit positive IDs")
	}
}
