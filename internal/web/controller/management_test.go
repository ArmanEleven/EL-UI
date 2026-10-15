package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

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

func TestManagementPortalKeepsInboundRoutesReadOnlyAndMasterRoutesProtected(t *testing.T) {
	if !isNativeOwnerUser(&model.User{Id: 1}, 1) {
		t.Fatal("native owner should be allowed")
	}
	if isNativeOwnerUser(&model.User{Id: 2}, 1) || isNativeOwnerUser(nil, 1) || isNativeOwnerUser(&model.User{Id: 1}, 0) {
		t.Fatal("only the exact native owner may access master management routes")
	}

	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })

	engine := gin.New()
	NewManagementController(engine.Group("/panel/api"))

	seenInboundReads := map[string]bool{}
	for _, route := range engine.Routes() {
		if strings.Contains(route.Path, "/management-api/inbounds") {
			if route.Method != http.MethodGet {
				t.Errorf("delegated management inbound route %s %s must be read-only", route.Method, route.Path)
			}
			seenInboundReads[route.Method+" "+route.Path] = true
		}
	}
	for _, route := range []string{
		"GET /panel/api/management-api/inbounds",
		"GET /panel/api/management-api/inbounds/:id",
	} {
		if !seenInboundReads[route] {
			t.Errorf("expected read-only management route %q to be registered", route)
		}
	}

	for _, path := range []string{
		"/panel/api/management-api/master/roles",
		"/panel/api/management-api/master/admins",
	} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Errorf("unauthenticated request to %s returned %d, want %d", path, response.Code, http.StatusUnauthorized)
		}
	}
}
