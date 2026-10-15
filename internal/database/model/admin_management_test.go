package model

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestManagementAdminNeverSerializesCredentialsOrOverrides(t *testing.T) {
	admin := ManagementAdmin{
		ID:                      3,
		Username:                "operator",
		PasswordHash:            "secret-hash-that-must-not-leak",
		RoleID:                  2,
		Status:                  "active",
		PermissionOverridesJSON: `{"max_users":10}`,
	}
	data, err := json.Marshal(admin)
	if err != nil {
		t.Fatalf("marshal admin: %v", err)
	}
	encoded := string(data)
	for _, secret := range []string{
		"secret-hash-that-must-not-leak", `"passwordHash"`,
		`"permissionOverridesJSON"`, `"nativeUserID"`,
	} {
		if strings.Contains(encoded, secret) {
			t.Errorf("sensitive field %q leaked in JSON: %s", secret, encoded)
		}
	}
	if !strings.Contains(encoded, `"username":"operator"`) {
		t.Fatalf("username should be serialized: %s", encoded)
	}
}

func TestManagementRoleNeverSerializesPolicyBlobs(t *testing.T) {
	role := ManagementAdminRole{
		ID:              2,
		Name:            "reseller",
		PermissionsJSON: `{"users":{"create":true}}`,
		LimitsJSON:      `{"max_users":10}`,
		AccessJSON:      `{"allowed_group_ids":[4]}`,
		HWIDJSON:        `{"mode":"override"}`,
	}
	data, err := json.Marshal(role)
	if err != nil {
		t.Fatalf("marshal role: %v", err)
	}
	encoded := string(data)
	for _, secret := range []string{
		"permissions_json", "limits_json", "allowed_group_ids", "override",
		`"permissionsJSON"`, `"limitsJSON"`,
	} {
		if strings.Contains(encoded, secret) {
			t.Errorf("internal policy field %q leaked in JSON: %s", secret, encoded)
		}
	}
	if !strings.Contains(encoded, `"name":"reseller"`) {
		t.Fatalf("role name should be serialized: %s", encoded)
	}
}

func TestManagementModelTableNamesAreStable(t *testing.T) {
	if got := (ManagementAdminRole{}).TableName(); got != "management_admin_roles" {
		t.Fatalf("role table = %q", got)
	}
	if got := (ManagementAdmin{}).TableName(); got != "management_admins" {
		t.Fatalf("admin table = %q", got)
	}
}
