package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func bindAdminTestForm(t *testing.T, method, body string, dst any) error {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(method, "/panel/api/admins", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return ctx.ShouldBind(dst)
}

func TestAdminCreateAcceptsFormEncodedPayload(t *testing.T) {
	values := url.Values{
		"username":              {"operator-1"},
		"password":              {"a-secure-test-password"},
		"maxClients":            {"5"},
		"allowUnlimitedClients": {"false"},
		"trafficQuotaBytes":     {"1073741824"},
		"allowUnlimitedTraffic": {"false"},
		"allowedInboundIds":     {"2", "7"},
	}
	var req adminCreateRequest
	if err := bindAdminTestForm(t, http.MethodPost, values.Encode(), &req); err != nil {
		t.Fatalf("bind form-encoded admin create request: %v", err)
	}
	if req.Username != "operator-1" || req.Password != "a-secure-test-password" {
		t.Fatalf("identity fields were not bound correctly: username=%q", req.Username)
	}
	if req.MaxClients != 5 || req.AllowUnlimitedClients {
		t.Fatalf("client quota was not bound correctly: %+v", req)
	}
	if req.TrafficQuotaBytes != 1073741824 || req.AllowUnlimitedTraffic {
		t.Fatalf("traffic quota was not bound correctly: %+v", req)
	}
	if !reflect.DeepEqual(req.AllowedInboundIDs, []int{2, 7}) {
		t.Fatalf("allowed inbound IDs = %v, want [2 7]", req.AllowedInboundIDs)
	}
}

func TestAdminUpdateAcceptsFormEncodedPayload(t *testing.T) {
	values := url.Values{
		"username":              {"operator-2"},
		"password":              {""},
		"enabled":               {"true"},
		"maxClients":            {"12"},
		"allowUnlimitedClients": {"false"},
		"trafficQuotaBytes":     {"2147483648"},
		"allowUnlimitedTraffic": {"false"},
		"allowedInboundIds":     {"3"},
	}
	var req adminUpdateRequest
	if err := bindAdminTestForm(t, http.MethodPost, values.Encode(), &req); err != nil {
		t.Fatalf("bind form-encoded admin update request: %v", err)
	}
	if req.Username == nil || *req.Username != "operator-2" {
		t.Fatalf("username = %v, want operator-2", req.Username)
	}
	if !req.Enabled || req.MaxClients != 12 || req.TrafficQuotaBytes != 2147483648 {
		t.Fatalf("quota/status fields were not bound correctly: %+v", req)
	}
	if !reflect.DeepEqual(req.AllowedInboundIDs, []int{3}) {
		t.Fatalf("allowed inbound IDs = %v, want [3]", req.AllowedInboundIDs)
	}
}

func TestAdminTwoFactorConfirmAcceptsFormEncodedCode(t *testing.T) {
	var req struct {
		Code string `json:"code" form:"code" binding:"required"`
	}
	if err := bindAdminTestForm(t, http.MethodPost, "code=123456", &req); err != nil {
		t.Fatalf("bind form-encoded 2FA code: %v", err)
	}
	if req.Code != "123456" {
		t.Fatalf("code = %q, want 123456", req.Code)
	}
}
