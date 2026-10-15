package session

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mhsanaei/3x-ui/v3/internal/database/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func TestSetLoginUserStoresOnlyUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions(sessionCookieName, cookie.NewStore([]byte("01234567890123456789012345678901"))))
	router.GET("/", func(c *gin.Context) {
		if err := SetLoginUser(c, &model.User{Id: 7, Username: "admin", Password: "hash"}); err != nil {
			t.Fatal(err)
		}
		got := sessions.Default(c).Get(loginUserKey)
		if got != 7 {
			t.Fatalf("stored session payload = %#v, want user id only", got)
		}
		c.Status(http.StatusNoContent)
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
}

func TestSessionUserIDSupportsLegacyUserPayload(t *testing.T) {
	id, ok := sessionUserID(model.User{Id: 11, Username: "admin", Password: "hash"})
	if !ok || id != 11 {
		t.Fatalf("legacy session payload resolved to (%d, %v), want (11, true)", id, ok)
	}
	id, ok = sessionUserID(&model.User{Id: 12, Username: "admin", Password: "hash"})
	if !ok || id != 12 {
		t.Fatalf("legacy pointer session payload resolved to (%d, %v), want (12, true)", id, ok)
	}
}

func TestManagementLoginIsSeparateFromNativePanelSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions(sessionCookieName, cookie.NewStore([]byte("01234567890123456789012345678901"))))
	router.GET("/management", func(c *gin.Context) {
		if err := SetLoginUser(c, &model.User{Id: 7, Username: "admin", Password: "hash"}); err != nil {
			t.Fatal(err)
		}
		if err := SetManagementLogin(c, 12); err != nil {
			t.Fatal(err)
		}
		if !IsManagementLogin(c) || ManagementAdminID(c) != 12 {
			t.Fatalf("management identity not stored")
		}
		if IsLogin(c) || GetLoginUser(c) != nil {
			t.Fatal("management session must not authenticate to native Master Panel")
		}
		if sessions.Default(c).Get(loginUserKey) != nil || sessions.Default(c).Get(loginEpochKey) != nil {
			t.Fatal("native identity keys must be removed when management login is set")
		}
		c.Status(http.StatusNoContent)
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/management", nil)
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
}

func TestSetNativeLoginClearsManagementIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions(sessionCookieName, cookie.NewStore([]byte("01234567890123456789012345678901"))))
	router.GET("/switch", func(c *gin.Context) {
		if err := SetManagementLogin(c, 12); err != nil {
			t.Fatal(err)
		}
		if err := SetLoginUser(c, &model.User{Id: 7}); err != nil {
			t.Fatal(err)
		}
		if IsManagementLogin(c) || ManagementAdminID(c) != 0 {
			t.Fatal("native login must clear management identity")
		}
		if got := sessions.Default(c).Get(loginUserKey); got != 7 {
			t.Fatalf("native login ID = %#v, want 7", got)
		}
		if got := sessions.Default(c).Get(loginEpochKey); got != int64(0) {
			t.Fatalf("native login epoch = %#v, want 0", got)
		}
		c.Status(http.StatusNoContent)
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/switch", nil)
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
}


func TestGetLoginUserWithoutSessionMiddlewareReturnsAnonymous(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		if IsLogin(c) || IsManagementLogin(c) || GetLoginUser(c) != nil {
			t.Fatal("request without session middleware must stay anonymous")
		}
		c.Status(http.StatusNoContent)
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
}
