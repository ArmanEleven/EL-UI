package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/logger"
	"github.com/mhsanaei/3x-ui/v3/internal/management/rbac"
	"github.com/mhsanaei/3x-ui/v3/internal/util/crypto"
	"github.com/mhsanaei/3x-ui/v3/internal/web/middleware"
	"github.com/mhsanaei/3x-ui/v3/internal/web/service"
	"github.com/mhsanaei/3x-ui/v3/internal/web/session"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	managementAdminKey  = "management_admin"
	managementPolicyKey = "management_policy"
)

var (
	managementUsernameRE     = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$`)
	managementClientCreateMu sync.Mutex
)

// ManagementController exposes the segregated management portal and its
// master-only administration endpoints. Every management request reloads the
// admin, role, and limits from the database so disabling an account or changing
// a role takes effect on the next request.
type ManagementController struct {
	inboundService service.InboundService
	clientService  service.ClientService
	xrayService    service.XrayService
}

func NewManagementController(g *gin.RouterGroup) *ManagementController {
	a := &ManagementController{}
	a.initRouter(g)
	return a
}

func (a *ManagementController) initRouter(g *gin.RouterGroup) {
	api := g.Group("/management-api")
	api.Use(middleware.CSRFMiddleware())
	api.POST("/auth/logout", a.requireManagementAdmin, a.logout)
	api.GET("/auth/me", a.requireManagementAdmin, a.me)
	api.GET("/inbounds", a.requireManagementAdmin, a.listInbounds)
	api.GET("/inbounds/:id", a.requireManagementAdmin, a.getInbound)
	api.GET("/clients", a.requireManagementAdmin, a.listClients)
	api.POST("/clients", a.requireManagementAdmin, a.createClient)

	master := api.Group("/master")
	master.Use(a.requireNativeOwner)
	master.GET("/inbounds", a.listMasterInbounds)
	master.GET("/roles", a.listRoles)
	master.POST("/roles", a.createRole)
	master.PUT("/roles/:id", a.updateRole)
	master.POST("/roles/:id", a.updateRole)
	master.GET("/admins", a.listAdmins)
	master.POST("/admins", a.createAdmin)
	master.PATCH("/admins/:id/status", a.setAdminStatus)
	master.POST("/admins/:id/status", a.setAdminStatus)
}

func managementJSON(c *gin.Context, status int, success bool, msg string, obj any) {
	c.Header("Cache-Control", "no-store")
	c.JSON(status, gin.H{"success": success, "msg": msg, "obj": obj})
}

func decodeStoredJSON(raw string, target any) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	return json.Unmarshal([]byte(raw), target)
}

func encodeStoredJSON(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		// These values are composed exclusively of Go structs/maps supported by
		// encoding/json; retain a safe empty object if that invariant changes.
		return "{}"
	}
	return string(data)
}

func managementRoleFromRow(row model.ManagementAdminRole) (rbac.Role, error) {
	role := rbac.NewRole(row.Name)
	role.IsOwner = row.IsOwner
	role.DisabledWhenLimited = row.DisabledWhenLimited
	role.DisconnectUsersWhenLimited = row.DisconnectUsersWhenLimited
	role.DisconnectUsersWhenDisabled = row.DisconnectUsersWhenDisabled
	if err := decodeStoredJSON(row.PermissionsJSON, &role.Permissions); err != nil {
		return rbac.Role{}, fmt.Errorf("decode role permissions: %w", err)
	}
	if err := decodeStoredJSON(row.LimitsJSON, &role.Limits); err != nil {
		return rbac.Role{}, fmt.Errorf("decode role limits: %w", err)
	}
	if err := decodeStoredJSON(row.FeaturesJSON, &role.Features); err != nil {
		return rbac.Role{}, fmt.Errorf("decode role features: %w", err)
	}
	if err := decodeStoredJSON(row.AccessJSON, &role.Access); err != nil {
		return rbac.Role{}, fmt.Errorf("decode role access: %w", err)
	}
	if err := decodeStoredJSON(row.HWIDJSON, &role.HWID); err != nil {
		return rbac.Role{}, fmt.Errorf("decode role HWID policy: %w", err)
	}
	if role.Permissions == nil {
		role.Permissions = make(rbac.Permissions)
	}
	if err := role.ValidateAssignable(); err != nil {
		return rbac.Role{}, err
	}
	return role, nil
}

func loadManagementRole(id int) (model.ManagementAdminRole, rbac.Role, error) {
	db := database.GetDB()
	if db == nil {
		return model.ManagementAdminRole{}, rbac.Role{}, fmt.Errorf("database unavailable")
	}
	var row model.ManagementAdminRole
	if err := db.First(&row, id).Error; err != nil {
		return model.ManagementAdminRole{}, rbac.Role{}, err
	}
	role, err := managementRoleFromRow(row)
	return row, role, err
}

func authenticateManagementCredentials(username, password string) (*model.ManagementAdmin, error) {
	db := database.GetDB()
	if db == nil || username == "" || password == "" {
		return nil, fmt.Errorf("invalid credentials")
	}
	var row model.ManagementAdmin
	if err := db.Where("username = ?", username).First(&row).Error; err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	if row.Status != string(rbac.AdminActive) && row.Status != string(rbac.AdminLimited) {
		return nil, fmt.Errorf("invalid credentials")
	}
	if !crypto.CheckPasswordHash(row.PasswordHash, password) {
		return nil, fmt.Errorf("invalid credentials")
	}
	_, role, err := loadManagementRole(row.RoleID)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	var overrides rbac.RoleLimits
	if err := decodeStoredJSON(row.PermissionOverridesJSON, &overrides); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	if err := rbac.ValidateLimitOverrides(role.Limits, overrides); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	return &row, nil
}

func (a *ManagementController) requireManagementAdmin(c *gin.Context) {
	adminID := session.ManagementAdminID(c)
	if adminID <= 0 || database.GetDB() == nil {
		managementJSON(c, http.StatusUnauthorized, false, "authentication required", nil)
		c.Abort()
		return
	}
	var row model.ManagementAdmin
	if err := database.GetDB().First(&row, adminID).Error; err != nil {
		_ = session.ClearSession(c)
		managementJSON(c, http.StatusUnauthorized, false, "authentication required", nil)
		c.Abort()
		return
	}
	if row.Status == string(rbac.AdminDisabled) {
		_ = session.ClearSession(c)
		managementJSON(c, http.StatusUnauthorized, false, "account disabled", nil)
		c.Abort()
		return
	}
	if row.Status != string(rbac.AdminActive) && row.Status != string(rbac.AdminLimited) {
		managementJSON(c, http.StatusUnauthorized, false, "account status invalid", nil)
		c.Abort()
		return
	}
	_, role, err := loadManagementRole(row.RoleID)
	if err != nil {
		logger.Warningf("management admin %d has an invalid role: %v", row.ID, err)
		managementJSON(c, http.StatusForbidden, false, "management role is invalid", nil)
		c.Abort()
		return
	}
	var overrides rbac.RoleLimits
	if err := decodeStoredJSON(row.PermissionOverridesJSON, &overrides); err != nil {
		managementJSON(c, http.StatusForbidden, false, "management policy is invalid", nil)
		c.Abort()
		return
	}
	if err := rbac.ValidateLimitOverrides(role.Limits, overrides); err != nil {
		managementJSON(c, http.StatusForbidden, false, "management policy is invalid", nil)
		c.Abort()
		return
	}
	admin := &rbac.Admin{
		ID: int64(row.ID), Status: rbac.AdminStatus(row.Status),
		Role: &role, PermissionOverrides: overrides,
	}
	if err := admin.Validate(); err != nil {
		managementJSON(c, http.StatusForbidden, false, "management policy is invalid", nil)
		c.Abort()
		return
	}
	c.Set(managementAdminKey, &row)
	c.Set(managementPolicyKey, admin)
	c.Next()
}

func isNativeOwnerUser(user *model.User, ownerID int) bool {
	return user != nil && ownerID > 0 && user.Id == ownerID
}

func (a *ManagementController) requireNativeOwner(c *gin.Context) {
	user := session.GetLoginUser(c)
	if user == nil {
		managementJSON(c, http.StatusUnauthorized, false, "Master Panel authentication required", nil)
		c.Abort()
		return
	}
	ownerID, err := nativeOwnerID()
	if err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not verify panel owner", nil)
		c.Abort()
		return
	}
	if !isNativeOwnerUser(user, ownerID) {
		managementJSON(c, http.StatusForbidden, false, "Master Panel owner access required", nil)
		c.Abort()
		return
	}
	c.Next()
}

func managementAdminFromContext(c *gin.Context) (*model.ManagementAdmin, *rbac.Admin, bool) {
	rowValue, rowOK := c.Get(managementAdminKey)
	policyValue, policyOK := c.Get(managementPolicyKey)
	row, okRow := rowValue.(*model.ManagementAdmin)
	policy, okPolicy := policyValue.(*rbac.Admin)
	return row, policy, rowOK && policyOK && okRow && okPolicy && row != nil && policy != nil
}

type managementMeView struct {
	ID       int             `json:"id"`
	Username string          `json:"username"`
	Status   string          `json:"status"`
	Role     rbac.Role       `json:"role"`
	Limits   rbac.RoleLimits `json:"effectiveLimits"`
}

func (a *ManagementController) me(c *gin.Context) {
	row, admin, ok := managementAdminFromContext(c)
	if !ok {
		managementJSON(c, http.StatusInternalServerError, false, "management context missing", nil)
		return
	}
	limits := rbac.EffectiveLimits(admin.Role.Limits, admin.PermissionOverrides)
	managementJSON(c, http.StatusOK, true, "", managementMeView{
		ID: row.ID, Username: row.Username, Status: row.Status, Role: *admin.Role, Limits: limits,
	})
}

func (a *ManagementController) logout(c *gin.Context) {
	if err := session.ClearSession(c); err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not clear session", nil)
		return
	}
	managementJSON(c, http.StatusOK, true, "logged out", nil)
}

type managementInboundView struct {
	ID           int    `json:"id"`
	Remark       string `json:"remark"`
	Enabled      bool   `json:"enabled"`
	Port         int    `json:"port"`
	Protocol     string `json:"protocol"`
	Tag          string `json:"tag,omitempty"`
	NodeID       *int   `json:"nodeId,omitempty"`
	ExpiryTime   int64  `json:"expiryTime"`
	TrafficReset string `json:"trafficReset"`
	Total        int64  `json:"total"`
	Up           int64  `json:"up"`
	Down         int64  `json:"down"`
	ClientCount  int    `json:"clientCount"`
}

func projectManagementInbound(inbound model.Inbound) managementInboundView {
	var settings struct {
		Clients []json.RawMessage `json:"clients"`
	}
	_ = json.Unmarshal([]byte(inbound.Settings), &settings)
	return managementInboundView{
		ID: inbound.Id, Remark: inbound.Remark, Enabled: inbound.Enable, Port: inbound.Port,
		Protocol: string(inbound.Protocol), Tag: inbound.Tag, NodeID: inbound.NodeID,
		ExpiryTime: inbound.ExpiryTime, TrafficReset: inbound.TrafficReset,
		Total: inbound.Total, Up: inbound.Up, Down: inbound.Down, ClientCount: len(settings.Clients),
	}
}

func canManagementAccessInbound(admin *rbac.Admin, inboundID int64) bool {
	if admin == nil || admin.Role == nil || inboundID <= 0 {
		return false
	}
	if err := rbac.CheckPermission(admin, rbac.ResourceInbounds, rbac.ActionRead); err != nil {
		return false
	}
	if admin.IsOwner() {
		return true
	}
	grant := admin.Role.Permissions[rbac.ResourceInbounds][rbac.ActionRead]
	switch grant.Scope {
	case rbac.ScopeAll:
		if admin.Role.Access.AllowedInboundIDs == nil {
			return true
		}
		return admin.Role.Access.AllowsInbound(inboundID)
	case rbac.ScopeOwn:
		return admin.Role.Access.AllowsInbound(inboundID)
	default:
		return false
	}
}

func canUseOwnedManagementInbound(admin *rbac.Admin, inboundID int64) bool {
	if !canManagementAccessInbound(admin, inboundID) {
		return false
	}
	ownerID, err := nativeOwnerID()
	if err != nil {
		return false
	}
	db := database.GetDB()
	if db == nil {
		return false
	}
	var count int64
	if err := db.Model(&model.Inbound{}).
		Where("id = ? AND user_id = ?", inboundID, ownerID).Count(&count).Error; err != nil {
		return false
	}
	return count == 1
}

func nativeOwnerID() (int, error) {
	db := database.GetDB()
	if db == nil {
		return 0, fmt.Errorf("database unavailable")
	}
	var owner model.User
	if err := db.Order("id ASC").First(&owner).Error; err != nil {
		return 0, err
	}
	return owner.Id, nil
}

func (a *ManagementController) listMasterInbounds(c *gin.Context) {
	ownerID, err := nativeOwnerID()
	if err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not load panel owner", nil)
		return
	}
	var inbounds []model.Inbound
	if err := database.GetDB().Model(&model.Inbound{}).
		Select("id, user_id, up, down, total, remark, enable, expiry_time, traffic_reset, port, protocol, tag, node_id, settings").
		Where("user_id = ?", ownerID).Order("id ASC").Find(&inbounds).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not list master inbounds", nil)
		return
	}
	out := make([]managementInboundView, 0, len(inbounds))
	for _, inbound := range inbounds {
		out = append(out, projectManagementInbound(inbound))
	}
	managementJSON(c, http.StatusOK, true, "", out)
}

func (a *ManagementController) listInbounds(c *gin.Context) {
	_, admin, ok := managementAdminFromContext(c)
	if !ok {
		managementJSON(c, http.StatusInternalServerError, false, "management context missing", nil)
		return
	}
	if err := rbac.CheckPermission(admin, rbac.ResourceInbounds, rbac.ActionRead); err != nil {
		managementJSON(c, http.StatusForbidden, false, "inbound access denied", nil)
		return
	}
	ownerID, err := nativeOwnerID()
	if err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not load panel owner", nil)
		return
	}
	var inbounds []model.Inbound
	err = database.GetDB().Model(&model.Inbound{}).
		Select("id, user_id, up, down, total, remark, enable, expiry_time, traffic_reset, port, protocol, tag, node_id, settings").
		Where("user_id = ?", ownerID).Order("id ASC").Find(&inbounds).Error
	if err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not list inbounds", nil)
		return
	}
	out := make([]managementInboundView, 0, len(inbounds))
	for _, inbound := range inbounds {
		if canManagementAccessInbound(admin, int64(inbound.Id)) {
			out = append(out, projectManagementInbound(inbound))
		}
	}
	managementJSON(c, http.StatusOK, true, "", out)
}

func (a *ManagementController) getInbound(c *gin.Context) {
	_, admin, ok := managementAdminFromContext(c)
	if !ok {
		managementJSON(c, http.StatusInternalServerError, false, "management context missing", nil)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		managementJSON(c, http.StatusBadRequest, false, "invalid inbound ID", nil)
		return
	}
	ownerID, err := nativeOwnerID()
	if err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not load panel owner", nil)
		return
	}
	var inbound model.Inbound
	err = database.GetDB().Model(&model.Inbound{}).
		Select("id, user_id, up, down, total, remark, enable, expiry_time, traffic_reset, port, protocol, tag, node_id, settings").
		Where("id = ? AND user_id = ?", id, ownerID).First(&inbound).Error
	if err != nil || !canManagementAccessInbound(admin, int64(id)) {
		// Use 404 for inaccessible IDs so the endpoint does not disclose which
		// other inbound IDs exist.
		managementJSON(c, http.StatusNotFound, false, "inbound not found", nil)
		return
	}
	managementJSON(c, http.StatusOK, true, "", projectManagementInbound(inbound))
}

type managementClientView struct {
	Email      string `json:"email" gorm:"column:email"`
	Enabled    bool   `json:"enabled" gorm:"column:enabled"`
	TotalGB    int64  `json:"totalGB" gorm:"column:total_gb"`
	ExpiryTime int64  `json:"expiryTime" gorm:"column:expiry_time"`
	Group      string `json:"group" gorm:"column:group_name"`
	CreatedAt  int64  `json:"createdAt" gorm:"column:created_at"`
}

func (a *ManagementController) listClients(c *gin.Context) {
	_, admin, ok := managementAdminFromContext(c)
	if !ok {
		managementJSON(c, http.StatusInternalServerError, false, "management context missing", nil)
		return
	}
	if err := rbac.CheckPermission(admin, rbac.ResourceClients, rbac.ActionRead); err != nil {
		managementJSON(c, http.StatusForbidden, false, "client access denied", nil)
		return
	}
	query := database.GetDB().Table("management_admin_clients AS mac").
		Select("clients.email AS email, clients.enable AS enabled, clients.total_gb AS total_gb, clients.expiry_time AS expiry_time, clients.group_name AS group_name, clients.created_at AS created_at").
		Joins("JOIN clients ON clients.email = mac.email")
	scope, err := rbac.ListOwnerScope(admin, rbac.ResourceClients, rbac.ActionRead)
	if err != nil {
		managementJSON(c, http.StatusForbidden, false, "client access denied", nil)
		return
	}
	if scope.Restricted {
		query = query.Where("mac.management_admin_id = ?", scope.AdminID)
	}
	var clients []managementClientView
	if err := query.Order("clients.created_at DESC").Limit(1000).Scan(&clients).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not list clients", nil)
		return
	}
	if clients == nil {
		clients = []managementClientView{}
	}
	managementJSON(c, http.StatusOK, true, "", clients)
}

func validateManagementClientPayload(admin *rbac.Admin, payload *service.ClientCreatePayload) error {
	if admin == nil || admin.Role == nil || payload == nil {
		return fmt.Errorf("invalid management context")
	}
	if len(payload.InboundIds) == 0 {
		return fmt.Errorf("at least one permitted inbound is required")
	}
	if payload.Client.ExpiryTime < 0 {
		return fmt.Errorf("client expiry must be non-negative")
	}
	seen := make(map[int]struct{}, len(payload.InboundIds))
	for _, id := range payload.InboundIds {
		if id <= 0 {
			return fmt.Errorf("inbound IDs must be positive")
		}
		if _, exists := seen[id]; exists {
			return fmt.Errorf("inbound IDs must not contain duplicates")
		}
		seen[id] = struct{}{}
		if !canUseOwnedManagementInbound(admin, int64(id)) {
			return fmt.Errorf("one or more selected inbounds are not permitted")
		}
	}
	if strings.TrimSpace(payload.Client.Email) == "" {
		return fmt.Errorf("client email is required")
	}
	if payload.Client.TotalGB < 0 {
		return fmt.Errorf("client volume must be non-negative")
	}
	if payload.LimitHwid < 0 {
		return fmt.Errorf("HWID limit must be non-negative")
	}
	effective := rbac.EffectiveLimits(admin.Role.Limits, admin.PermissionOverrides)
	if err := effective.Validate(); err != nil {
		return err
	}
	var totalBytes int64
	if payload.Client.TotalGB > 0 {
		if payload.Client.TotalGB > math.MaxInt64/(1<<30) {
			return fmt.Errorf("client volume is too large")
		}
		totalBytes = payload.Client.TotalGB * (1 << 30)
	}
	if (effective.DataLimitMin != nil || effective.DataLimitMax != nil) && payload.Client.TotalGB == 0 {
		return fmt.Errorf("unlimited volume is not allowed by this role")
	}
	if effective.DataLimitMin != nil && totalBytes < *effective.DataLimitMin {
		return fmt.Errorf("client volume is below the minimum allowed")
	}
	if effective.DataLimitMax != nil && totalBytes > *effective.DataLimitMax {
		return fmt.Errorf("client volume exceeds the maximum allowed")
	}
	if (effective.ExpireMin != nil || effective.ExpireMax != nil) && payload.Client.ExpiryTime == 0 {
		return fmt.Errorf("unlimited expiry is not allowed by this role")
	}
	if payload.Client.ExpiryTime > 0 {
		remainingSeconds := (payload.Client.ExpiryTime - time.Now().UnixMilli()) / 1000
		if remainingSeconds <= 0 {
			return fmt.Errorf("client expiry must be in the future")
		}
		if effective.ExpireMin != nil && remainingSeconds < *effective.ExpireMin {
			return fmt.Errorf("client expiry is below the minimum allowed")
		}
		if effective.ExpireMax != nil && remainingSeconds > *effective.ExpireMax {
			return fmt.Errorf("client expiry exceeds the maximum allowed")
		}
	}
	if effective.MinHWIDPerUser != nil && int64(payload.LimitHwid) < *effective.MinHWIDPerUser {
		return fmt.Errorf("HWID limit is below the minimum allowed")
	}
	if effective.MaxHWIDPerUser != nil && int64(payload.LimitHwid) > *effective.MaxHWIDPerUser {
		return fmt.Errorf("HWID limit exceeds the maximum allowed")
	}
	return nil
}

func (a *ManagementController) createClient(c *gin.Context) {
	_, admin, ok := managementAdminFromContext(c)
	if !ok {
		managementJSON(c, http.StatusInternalServerError, false, "management context missing", nil)
		return
	}
	if err := rbac.CheckPermission(admin, rbac.ResourceClients, rbac.ActionCreate); err != nil {
		managementJSON(c, http.StatusForbidden, false, "client creation denied", nil)
		return
	}
	var payload service.ClientCreatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		managementJSON(c, http.StatusBadRequest, false, "invalid client payload", nil)
		return
	}
	if err := validateManagementClientPayload(admin, &payload); err != nil {
		managementJSON(c, http.StatusForbidden, false, err.Error(), nil)
		return
	}
	db := database.GetDB()
	if db == nil {
		managementJSON(c, http.StatusInternalServerError, false, "database unavailable", nil)
		return
	}
	managementClientCreateMu.Lock()
	defer managementClientCreateMu.Unlock()

	errEmailTaken := errors.New("management client email already exists")
	errLimitReached := errors.New("management client limit reached")
	err := db.Transaction(func(tx *gorm.DB) error {
		// Serialize reservations for this admin before counting, so concurrent
		// requests cannot both pass the same max-users check.
		var locked model.ManagementAdmin
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&locked, int(admin.ID)).Error; err != nil {
			return err
		}
		var existing int64
		if err := tx.Model(&model.ClientRecord{}).
			Where("LOWER(email) = LOWER(?)", strings.TrimSpace(payload.Client.Email)).
			Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return errEmailTaken
		}
		var owned int64
		if err := tx.Model(&model.ManagementAdminClient{}).
			Where("management_admin_id = ?", admin.ID).Count(&owned).Error; err != nil {
			return err
		}
		limits := rbac.EffectiveLimits(admin.Role.Limits, admin.PermissionOverrides)
		if limits.MaxUsers != nil && owned >= *limits.MaxUsers {
			return errLimitReached
		}
		return tx.Create(&model.ManagementAdminClient{
			ManagementAdminID: int(admin.ID),
			Email:             strings.TrimSpace(payload.Client.Email),
			CreatedAt:         time.Now().UTC(),
		}).Error
	})
	if errors.Is(err, errEmailTaken) {
		managementJSON(c, http.StatusConflict, false, "client email is already in use", nil)
		return
	}
	if errors.Is(err, errLimitReached) {
		managementJSON(c, http.StatusForbidden, false, "client count limit reached", nil)
		return
	}
	if err != nil {
		managementJSON(c, http.StatusConflict, false, "client ownership could not be reserved", nil)
		return
	}

	needRestart, createErr := a.clientService.Create(&a.inboundService, &payload)
	if needRestart {
		a.xrayService.SetToNeedRestart()
	}
	if needRestart || createErr == nil {
		notifyClientsChanged()
	}
	if createErr != nil {
		// The service reports needRestart when it partially applied to an
		// inbound. Keep the ownership reservation in that case so another admin
		// cannot claim the email of an already-created client.
		if !needRestart {
			_ = db.Where("management_admin_id = ? AND email = ?", admin.ID, strings.TrimSpace(payload.Client.Email)).Delete(&model.ManagementAdminClient{}).Error
		}
		logger.Warningf("management admin %d failed to create client %q: %v", admin.ID, payload.Client.Email, createErr)
		managementJSON(c, http.StatusUnprocessableEntity, false, "client creation failed", nil)
		return
	}
	logger.Infof("management admin %d created client %q on %d inbound(s)", admin.ID, payload.Client.Email, len(payload.InboundIds))
	managementJSON(c, http.StatusCreated, true, "client created", gin.H{"email": payload.Client.Email})
}

type managementRoleInput struct {
	Name                        string                `json:"name"`
	Permissions                 rbac.Permissions      `json:"permissions"`
	Limits                      rbac.RoleLimits       `json:"limits"`
	Features                    rbac.RoleFeatures     `json:"features"`
	Access                      rbac.RoleAccess       `json:"access"`
	HWID                        rbac.RoleHWIDSettings `json:"hwid"`
	DisabledWhenLimited         bool                  `json:"disabledWhenLimited"`
	DisconnectUsersWhenLimited  bool                  `json:"disconnectUsersWhenLimited"`
	DisconnectUsersWhenDisabled bool                  `json:"disconnectUsersWhenDisabled"`
}

func (input managementRoleInput) toRole() rbac.Role {
	role := rbac.NewRole(strings.TrimSpace(input.Name))
	role.Permissions = input.Permissions
	if role.Permissions == nil {
		role.Permissions = make(rbac.Permissions)
	}
	role.Limits = input.Limits
	role.Features = input.Features
	role.Access = input.Access
	role.HWID = input.HWID
	role.DisabledWhenLimited = input.DisabledWhenLimited
	role.DisconnectUsersWhenLimited = input.DisconnectUsersWhenLimited
	role.DisconnectUsersWhenDisabled = input.DisconnectUsersWhenDisabled
	return role
}

func managementRoleRow(role rbac.Role) model.ManagementAdminRole {
	return model.ManagementAdminRole{
		Name:                        role.Name,
		IsOwner:                     false,
		PermissionsJSON:             encodeStoredJSON(role.Permissions),
		LimitsJSON:                  encodeStoredJSON(role.Limits),
		FeaturesJSON:                encodeStoredJSON(role.Features),
		AccessJSON:                  encodeStoredJSON(role.Access),
		HWIDJSON:                    encodeStoredJSON(role.HWID),
		DisabledWhenLimited:         role.DisabledWhenLimited,
		DisconnectUsersWhenLimited:  role.DisconnectUsersWhenLimited,
		DisconnectUsersWhenDisabled: role.DisconnectUsersWhenDisabled,
	}
}

func (a *ManagementController) listRoles(c *gin.Context) {
	var rows []model.ManagementAdminRole
	if err := database.GetDB().Order("id ASC").Find(&rows).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not list roles", nil)
		return
	}
	out := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		role, err := managementRoleFromRow(row)
		if err != nil {
			managementJSON(c, http.StatusInternalServerError, false, "stored role is invalid", nil)
			return
		}
		out = append(out, gin.H{"id": row.ID, "role": role})
	}
	managementJSON(c, http.StatusOK, true, "", out)
}

func (a *ManagementController) createRole(c *gin.Context) {
	var input managementRoleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		managementJSON(c, http.StatusBadRequest, false, "invalid role payload", nil)
		return
	}
	role := input.toRole()
	if err := role.ValidateAssignable(); err != nil {
		managementJSON(c, http.StatusBadRequest, false, err.Error(), nil)
		return
	}
	row := managementRoleRow(role)
	if err := database.GetDB().Create(&row).Error; err != nil {
		managementJSON(c, http.StatusConflict, false, "role could not be created", nil)
		return
	}
	created, err := managementRoleFromRow(row)
	if err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "created role could not be read", nil)
		return
	}
	managementJSON(c, http.StatusCreated, true, "role created", gin.H{"id": row.ID, "role": created})
}

func (a *ManagementController) updateRole(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		managementJSON(c, http.StatusBadRequest, false, "invalid role ID", nil)
		return
	}
	var current model.ManagementAdminRole
	if err := database.GetDB().First(&current, id).Error; err != nil {
		managementJSON(c, http.StatusNotFound, false, "role not found", nil)
		return
	}
	if current.IsOwner {
		managementJSON(c, http.StatusForbidden, false, "the owner role is protected", nil)
		return
	}
	var input managementRoleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		managementJSON(c, http.StatusBadRequest, false, "invalid role payload", nil)
		return
	}
	role := input.toRole()
	if err := role.ValidateAssignable(); err != nil {
		managementJSON(c, http.StatusBadRequest, false, err.Error(), nil)
		return
	}
	// Refuse role-limit changes that would make existing per-admin overrides
	// wider than the new role policy, which would lock those admins out.
	var assigned []model.ManagementAdmin
	if err := database.GetDB().Where("role_id = ?", id).Find(&assigned).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not validate assigned administrators", nil)
		return
	}
	for _, admin := range assigned {
		var overrides rbac.RoleLimits
		if err := decodeStoredJSON(admin.PermissionOverridesJSON, &overrides); err != nil {
			managementJSON(c, http.StatusConflict, false, "an assigned administrator has invalid limit overrides", nil)
			return
		}
		if err := rbac.ValidateLimitOverrides(role.Limits, overrides); err != nil {
			managementJSON(c, http.StatusConflict, false, "new role limits conflict with an assigned administrator override", nil)
			return
		}
	}
	updates := map[string]any{
		"name": role.Name, "is_owner": false,
		"permissions_json":               encodeStoredJSON(role.Permissions),
		"limits_json":                    encodeStoredJSON(role.Limits),
		"features_json":                  encodeStoredJSON(role.Features),
		"access_json":                    encodeStoredJSON(role.Access),
		"hwid_json":                      encodeStoredJSON(role.HWID),
		"disabled_when_limited":          role.DisabledWhenLimited,
		"disconnect_users_when_limited":  role.DisconnectUsersWhenLimited,
		"disconnect_users_when_disabled": role.DisconnectUsersWhenDisabled,
		"updated_at":                     time.Now().UTC(),
	}
	if err := database.GetDB().Model(&model.ManagementAdminRole{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		managementJSON(c, http.StatusConflict, false, "role could not be updated", nil)
		return
	}
	managementJSON(c, http.StatusOK, true, "role updated", gin.H{"id": id, "role": role})
}

type managementAdminInput struct {
	Username            string          `json:"username"`
	Password            string          `json:"password"`
	RoleID              int             `json:"roleId"`
	PermissionOverrides rbac.RoleLimits `json:"permissionOverrides"`
}

type managementAdminView struct {
	ID          int        `json:"id"`
	Username    string     `json:"username"`
	RoleID      int        `json:"roleId"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
}

func (a *ManagementController) listAdmins(c *gin.Context) {
	var rows []model.ManagementAdmin
	if err := database.GetDB().Order("id ASC").Find(&rows).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not list administrators", nil)
		return
	}
	out := make([]managementAdminView, 0, len(rows))
	for _, row := range rows {
		out = append(out, managementAdminView{
			ID: row.ID, Username: row.Username, RoleID: row.RoleID,
			Status: row.Status, CreatedAt: row.CreatedAt, LastLoginAt: row.LastLoginAt,
		})
	}
	managementJSON(c, http.StatusOK, true, "", out)
}

func (a *ManagementController) createAdmin(c *gin.Context) {
	var input managementAdminInput
	if err := c.ShouldBindJSON(&input); err != nil {
		managementJSON(c, http.StatusBadRequest, false, "invalid administrator payload", nil)
		return
	}
	input.Username = strings.TrimSpace(input.Username)
	if !managementUsernameRE.MatchString(input.Username) {
		managementJSON(c, http.StatusBadRequest, false, "username must be 3-64 safe characters", nil)
		return
	}
	if len(input.Password) < 12 || len(input.Password) > 72 {
		managementJSON(c, http.StatusBadRequest, false, "password must be 12-72 bytes for bcrypt", nil)
		return
	}
	_, role, err := loadManagementRole(input.RoleID)
	if err != nil {
		managementJSON(c, http.StatusBadRequest, false, "invalid or protected role", nil)
		return
	}
	if err := input.PermissionOverrides.Validate(); err != nil {
		managementJSON(c, http.StatusBadRequest, false, err.Error(), nil)
		return
	}
	if err := rbac.ValidateLimitOverrides(role.Limits, input.PermissionOverrides); err != nil {
		managementJSON(c, http.StatusBadRequest, false, err.Error(), nil)
		return
	}
	db := database.GetDB()
	var nativeMatches int64
	if err := db.Model(&model.User{}).Where("username = ?", input.Username).Count(&nativeMatches).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not check username", nil)
		return
	}
	if nativeMatches > 0 {
		managementJSON(c, http.StatusConflict, false, "username is already used by the Master Panel", nil)
		return
	}
	var duplicate int64
	if err := db.Model(&model.ManagementAdmin{}).Where("username = ?", input.Username).Count(&duplicate).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "could not check username", nil)
		return
	}
	if duplicate > 0 {
		managementJSON(c, http.StatusConflict, false, "username is already in use", nil)
		return
	}
	hash, err := crypto.HashPasswordAsBcrypt(input.Password)
	if err != nil {
		managementJSON(c, http.StatusBadRequest, false, "password could not be hashed", nil)
		return
	}
	row := model.ManagementAdmin{
		Username: input.Username, PasswordHash: hash, RoleID: input.RoleID,
		Status:                  string(rbac.AdminActive),
		PermissionOverridesJSON: encodeStoredJSON(input.PermissionOverrides),
	}
	if err := db.Create(&row).Error; err != nil {
		managementJSON(c, http.StatusConflict, false, "administrator could not be created", nil)
		return
	}
	logger.Infof("Master Panel created management admin %d (%q) with role %d", row.ID, row.Username, row.RoleID)
	managementJSON(c, http.StatusCreated, true, "administrator created", managementAdminView{
		ID: row.ID, Username: row.Username, RoleID: row.RoleID, Status: row.Status,
		CreatedAt: row.CreatedAt, LastLoginAt: row.LastLoginAt,
	})
}

func (a *ManagementController) setAdminStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		managementJSON(c, http.StatusBadRequest, false, "invalid administrator ID", nil)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		managementJSON(c, http.StatusBadRequest, false, "invalid status payload", nil)
		return
	}
	switch body.Status {
	case string(rbac.AdminActive), string(rbac.AdminDisabled), string(rbac.AdminLimited):
	default:
		managementJSON(c, http.StatusBadRequest, false, "status must be active, disabled or limited", nil)
		return
	}
	var row model.ManagementAdmin
	if err := database.GetDB().First(&row, id).Error; err != nil {
		managementJSON(c, http.StatusNotFound, false, "administrator not found", nil)
		return
	}
	row.Status = body.Status
	if err := database.GetDB().Model(&row).Update("status", body.Status).Error; err != nil {
		managementJSON(c, http.StatusInternalServerError, false, "status could not be updated", nil)
		return
	}
	logger.Infof("Master Panel changed management admin %d status to %q", row.ID, body.Status)
	managementJSON(c, http.StatusOK, true, "administrator status updated", gin.H{"id": row.ID, "status": body.Status})
}
