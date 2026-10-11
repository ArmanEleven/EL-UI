package controller

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/dbtest"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/web/session"
)

func newAdminAccessTestEngine(t *testing.T, enabled, secondaryActor bool) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dbDir := t.TempDir()
	t.Setenv("XUI_DB_FOLDER", dbDir)
	dbtest.InitDB(t, filepath.Join(dbDir, "x-ui.db"))

	var owner model.User
	if err := database.GetDB().Order("id ASC").First(&owner).Error; err != nil {
		t.Fatalf("load primary owner: %v", err)
	}
	secondary := model.User{Username: "secondary", Password: "test-password"}
	if err := database.GetDB().Create(&secondary).Error; err != nil {
		t.Fatalf("create secondary admin: %v", err)
	}
	if err := database.GetDB().Create(&model.AdminProfile{
		UserID:                secondary.Id,
		Enabled:               enabled,
		MaxClients:            10,
		TrafficQuotaBytes:     10 * 1024 * 1024 * 1024,
		AllowedInboundIDsJSON: "[]",
	}).Error; err != nil {
		t.Fatalf("create admin profile: %v", err)
	}

	actor := &owner
	if secondaryActor {
		actor = &secondary
	}
	engine := gin.New()
	engine.Use(func(c *gin.Context) {
		session.SetAPIAuthUser(c, actor)
		c.Next()
	})
	a := &APIController{}
	api := engine.Group("/panel/api")
	api.Use(a.enforceMultiAdminAccess)
	api.GET("/admins/me", func(c *gin.Context) { c.Status(http.StatusOK) })
	api.GET("/inbounds/options", func(c *gin.Context) { c.Status(http.StatusOK) })
	api.POST("/clients/add", func(c *gin.Context) { c.Status(http.StatusOK) })
	api.GET("/server/status", func(c *gin.Context) { c.Status(http.StatusOK) })
	api.POST("/inbounds/update/:id", func(c *gin.Context) { c.Status(http.StatusOK) })
	engine.GET("/ws", (&WebSocketController{}).HandleWebSocket)
	return engine
}

func TestSecondaryAdminAccessIsNarrow(t *testing.T) {
	engine := newAdminAccessTestEngine(t, true, true)
	cases := []struct {
		name   string
		method string
		path   string
		want   int
	}{
		{name: "own profile", method: http.MethodGet, path: "/panel/api/admins/me", want: http.StatusOK},
		{name: "safe inbound summary", method: http.MethodGet, path: "/panel/api/inbounds/options", want: http.StatusOK},
		{name: "create client", method: http.MethodPost, path: "/panel/api/clients/add", want: http.StatusOK},
		{name: "master status denied", method: http.MethodGet, path: "/panel/api/server/status", want: http.StatusForbidden},
		{name: "inbound mutation denied", method: http.MethodPost, path: "/panel/api/inbounds/update/1", want: http.StatusForbidden},
		{name: "master websocket denied", method: http.MethodGet, path: "/ws", want: http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d; body=%s", rec.Code, tc.want, rec.Body.String())
			}
		})
	}
}

func TestDisabledSecondaryAdminIsDeniedEverywhere(t *testing.T) {
	engine := newAdminAccessTestEngine(t, false, true)
	req := httptest.NewRequest(http.MethodGet, "/panel/api/admins/me", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d; body=%s", rec.Code, http.StatusForbidden, rec.Body.String())
	}
}

func TestOwnerKeepsMasterAccess(t *testing.T) {
	engine := newAdminAccessTestEngine(t, true, false)
	req := httptest.NewRequest(http.MethodGet, "/panel/api/server/status", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}
}
