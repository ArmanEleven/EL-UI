package controller

import (
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/util/totp"
	"github.com/mhsanaei/3x-ui/v3/internal/web/service"
	"github.com/mhsanaei/3x-ui/v3/internal/web/service/panel"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AdminController struct {
	service        panel.AdminService
	settingService service.SettingService
}

type adminCreateRequest struct {
	Username              string `json:"username" binding:"required"`
	Password              string `json:"password" binding:"required"`
	MaxClients            int    `json:"maxClients"`
	AllowUnlimitedClients bool   `json:"allowUnlimitedClients"`
	TrafficQuotaBytes     int64  `json:"trafficQuotaBytes"`
	AllowUnlimitedTraffic bool   `json:"allowUnlimitedTraffic"`
	AllowedInboundIDs     []int  `json:"allowedInboundIds"`
}

type adminUpdateRequest struct {
	Username              *string `json:"username"`
	Password              *string `json:"password"`
	Enabled               bool    `json:"enabled"`
	MaxClients            int     `json:"maxClients"`
	AllowUnlimitedClients bool    `json:"allowUnlimitedClients"`
	TrafficQuotaBytes     int64   `json:"trafficQuotaBytes"`
	AllowUnlimitedTraffic bool    `json:"allowUnlimitedTraffic"`
	AllowedInboundIDs     []int   `json:"allowedInboundIds"`
}

func NewAdminController(g *gin.RouterGroup, settings service.SettingService) *AdminController {
	a := &AdminController{settingService: settings}
	r := g.Group("/admins")
	r.GET("", a.list)
	r.GET("/me", a.me)
	r.GET("/me/2fa", a.twoFactorStatus)
	r.POST("/me/2fa/setup", a.twoFactorSetup)
	r.POST("/me/2fa/confirm", a.twoFactorConfirm)
	r.POST("", a.create)
	r.PUT("/:id", a.update)
	r.POST("/:id", a.update)
	r.DELETE("/:id", a.delete)
	r.POST("/:id/2fa/reset", a.resetTwoFactor)
	return a
}

func (a *AdminController) twoFactorStatus(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if a.service.IsOwner(u.Id) {
		c.JSON(http.StatusOK, gin.H{"success": true, "obj": gin.H{"panelTwoFactorEnabled": false, "twoFactorEnabled": false}})
		return
	}
	profile, err := a.service.GetProfile(u.Id)
	if err != nil {
		a.writeError(c, err)
		return
	}
	required, err := a.settingService.GetTwoFactorEnable()
	if err != nil {
		a.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "obj": gin.H{
		"panelTwoFactorEnabled": required,
		"twoFactorEnabled":      profile.TwoFactorEnabled,
	}})
}

func (a *AdminController) twoFactorSetup(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if a.service.IsOwner(u.Id) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "msg": "برای مالک پنل نیازی به تنظیم 2FA ادمین نیست"})
		return
	}
	profile, err := a.service.GetProfile(u.Id)
	if err != nil {
		a.writeError(c, err)
		return
	}
	if profile.TwoFactorEnabled {
		c.JSON(http.StatusConflict, gin.H{"success": false, "msg": "تأیید دومرحله\u200cای قبلاً فعال شده است"})
		return
	}
	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil {
		a.writeError(c, err)
		return
	}
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)
	if err := database.GetDB().Model(&model.AdminProfile{}).Where("user_id = ?", u.Id).Update("two_factor_pending", secret).Error; err != nil {
		a.writeError(c, err)
		return
	}
	account := url.PathEscape(u.Username)
	issuer := url.QueryEscape("Eleven Panel")
	uri := "otpauth://totp/" + issuer + ":" + account + "?secret=" + secret + "&issuer=" + issuer + "&algorithm=SHA1&digits=6&period=30"
	c.JSON(http.StatusOK, gin.H{"success": true, "obj": gin.H{"secret": secret, "otpauthUrl": uri}})
}

func (a *AdminController) twoFactorConfirm(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if a.service.IsOwner(u.Id) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "msg": "برای مالک پنل نیازی به تنظیم 2FA ادمین نیست"})
		return
	}
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Code) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "کد تأیید معتبر نیست"})
		return
	}
	profile, err := a.service.GetProfile(u.Id)
	if err != nil {
		a.writeError(c, err)
		return
	}
	secret := strings.TrimSpace(profile.TwoFactorPending)
	if secret == "" || !totp.VerifyWithSkew(secret, strings.TrimSpace(req.Code), time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "کد تأیید نادرست است"})
		return
	}
	if err := database.GetDB().Model(&model.AdminProfile{}).Where("user_id = ?", u.Id).Updates(map[string]any{
		"two_factor_secret":  secret,
		"two_factor_pending": "",
		"two_factor_enabled": true,
	}).Error; err != nil {
		a.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "msg": "تأیید دومرحله\u200cای فعال شد"})
}

func (a *AdminController) resetTwoFactor(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if !a.service.IsOwner(u.Id) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "msg": "فقط مالک پنل می\u200cتواند 2FA ادمین را بازنشانی کند"})
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "شناسه ادمین معتبر نیست"})
		return
	}
	if err := database.GetDB().Model(&model.AdminProfile{}).Where("user_id = ?", id).Updates(map[string]any{
		"two_factor_enabled": false,
		"two_factor_secret":  "",
		"two_factor_pending": "",
	}).Error; err != nil {
		a.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "msg": "2FA ادمین بازنشانی شد"})
}

func (a *AdminController) list(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	rows, err := a.service.List(u.Id)
	if err != nil {
		a.writeError(c, err)
		return
	}
	jsonObj(c, rows, nil)
}

func (a *AdminController) me(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if a.service.IsOwner(u.Id) {
		jsonObj(c, gin.H{"userId": u.Id, "username": u.Username, "role": "owner"}, nil)
		return
	}
	p, err := a.service.GetProfile(u.Id)
	if err != nil {
		a.writeError(c, err)
		return
	}
	var inboundIDs []int
	if err := json.Unmarshal([]byte(p.AllowedInboundIDsJSON), &inboundIDs); err != nil {
		a.writeError(c, err)
		return
	}
	jsonObj(c, gin.H{
		"userId":                u.Id,
		"username":              u.Username,
		"role":                  "admin",
		"enabled":               p.Enabled,
		"maxClients":            p.MaxClients,
		"allowUnlimitedClients": p.AllowUnlimitedClients,
		"trafficQuotaBytes":     p.TrafficQuotaBytes,
		"allowUnlimitedTraffic": p.AllowUnlimitedTraffic,
		"allowedInboundIds":     inboundIDs,
		"allocatedClients":      p.AllocatedClients,
		"allocatedTrafficBytes": p.AllocatedTrafficBytes,
	}, nil)
}

func (a *AdminController) create(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	var req adminCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "داده\u200cهای ادمین معتبر نیست"})
		return
	}
	id, err := a.service.Create(
		u.Id,
		req.Username,
		req.Password,
		req.MaxClients,
		req.AllowUnlimitedClients,
		req.TrafficQuotaBytes,
		req.AllowUnlimitedTraffic,
		req.AllowedInboundIDs,
	)
	if err != nil {
		a.writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "userId": id, "msg": "ادمین با موفقیت ساخته شد"})
}

func (a *AdminController) update(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "شناسه ادمین معتبر نیست"})
		return
	}
	var req adminUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "داده\u200cهای ادمین معتبر نیست"})
		return
	}
	if err := a.service.Update(
		u.Id,
		id,
		req.Username,
		req.Password,
		req.Enabled,
		req.MaxClients,
		req.AllowUnlimitedClients,
		req.TrafficQuotaBytes,
		req.AllowUnlimitedTraffic,
		req.AllowedInboundIDs,
	); err != nil {
		a.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "msg": "تغییرات ادمین ذخیره شد"})
}

func (a *AdminController) delete(c *gin.Context) {
	u := optionalLoginUser(c)
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "شناسه ادمین معتبر نیست"})
		return
	}
	if err := a.service.Delete(u.Id, id); err != nil {
		a.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "msg": "ادمین حذف شد"})
}

func (a *AdminController) writeError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	msg := "خطای داخلی سرور"
	switch {
	case errors.Is(err, panel.ErrAdminForbidden):
		status = http.StatusForbidden
		msg = "دسترسی کافی نیست"
	case errors.Is(err, panel.ErrAdminNotFound), errors.Is(err, gorm.ErrRecordNotFound):
		status = http.StatusNotFound
		msg = "ادمین پیدا نشد"
	case errors.Is(err, panel.ErrAdminInvalid):
		status = http.StatusBadRequest
		msg = err.Error()
	}
	c.JSON(status, gin.H{"success": false, "msg": msg})
}
