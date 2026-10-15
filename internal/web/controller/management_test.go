package controller

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/management/rbac"
	"github.com/mhsanaei/3x-ui/v3/internal/web/service"
)

func TestProjectManagementInboundDoesNotExposeStoredSettings(t *testing.T) {
	inbound := model.Inbound{
		Id: 7, Remark: "read-only", Port: 443, Protocol: model.VLESS,
		Settings: `{"clients":[{"email":"hidden@example.com","id":"secret-uuid","password":"secret-password"}]}`,
	}
	view := projectManagementInbound(inbound)
	if view.ClientCount != 1 {
		t.Fatalf("client count = %d, want 1", view.ClientCount)
	}
	encoded, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	body := string(encoded)
	for _, forbidden := range []string{"hidden@example.com", "secret-uuid", "secret-password", "settings"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("management inbound response leaked %q: %s", forbidden, body)
		}
	}
}

func TestCanManagementAccessInboundRequiresReadGrantAndExplicitOwnID(t *testing.T) {
	admin := &rbac.Admin{
		ID: 3, Status: rbac.AdminActive,
		Role: &rbac.Role{
			Name: "operator",
			Permissions: rbac.Permissions{
				rbac.ResourceInbounds: {rbac.ActionRead: rbac.AllowOwn()},
			},
			Access: rbac.RoleAccess{AllowedInboundIDs: []int64{10, 12}},
		},
	}
	if !canManagementAccessInbound(admin, 10) {
		t.Fatal("explicitly allowed inbound should be visible")
	}
	if canManagementAccessInbound(admin, 11) {
		t.Fatal("inbound outside the allow-list must not be visible")
	}
	admin.Role.Access.AllowedInboundIDs = nil
	if canManagementAccessInbound(admin, 10) {
		t.Fatal("OWN scope without an explicit inbound allow-list must deny")
	}
}

func TestValidateManagementClientPayloadRejectsNegativeExpiryBeforeDatabaseLookup(t *testing.T) {
	admin := &rbac.Admin{
		ID: 3, Status: rbac.AdminActive,
		Role: &rbac.Role{
			Name: "writer",
			Permissions: rbac.Permissions{
				rbac.ResourceClients: {rbac.ActionCreate: rbac.AllowOwn()},
			},
		},
	}
	payload := &service.ClientCreatePayload{
		Client:     model.Client{Email: "client@example.com", ExpiryTime: -1},
		InboundIds: []int{1},
	}
	err := validateManagementClientPayload(admin, payload)
	if err == nil || !strings.Contains(err.Error(), "expiry") {
		t.Fatalf("negative expiry should be rejected before database checks, got %v", err)
	}
}

func TestCanManagementAccessInboundAllScopeMayBeRestrictedByAllowList(t *testing.T) {
	admin := &rbac.Admin{
		ID: 3, Status: rbac.AdminActive,
		Role: &rbac.Role{
			Name:        "reader",
			Permissions: rbac.Permissions{rbac.ResourceInbounds: {rbac.ActionRead: rbac.AllowAll()}},
		},
	}
	if !canManagementAccessInbound(admin, 10) {
		t.Fatal("ALL scope without extra allow-list should allow inbound")
	}
	admin.Role.Access.AllowedInboundIDs = []int64{12}
	if canManagementAccessInbound(admin, 10) || !canManagementAccessInbound(admin, 12) {
		t.Fatal("configured allow-list must narrow even ALL scope")
	}
}
