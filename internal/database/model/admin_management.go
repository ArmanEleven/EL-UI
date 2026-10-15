package model

import "time"

// ManagementAdminRole stores an EL-UI management-plane role separately from
// native 3X-UI protocol/client records. JSON policy fields remain text so both
// supported GORM dialects (SQLite and PostgreSQL) can persist the same format.
type ManagementAdminRole struct {
	ID                           int       `json:"id" gorm:"primaryKey;autoIncrement"`
	Name                         string    `json:"name" gorm:"size:64;not null;uniqueIndex:ux_management_admin_roles_name"`
	IsOwner                      bool      `json:"isOwner" gorm:"not null;default:false;index"`
	PermissionsJSON              string    `json:"-" gorm:"type:text;not null"`
	LimitsJSON                   string    `json:"-" gorm:"type:text;not null"`
	FeaturesJSON                 string    `json:"-" gorm:"type:text;not null"`
	AccessJSON                   string    `json:"-" gorm:"type:text;not null"`
	HWIDJSON                     string    `json:"-" gorm:"type:text;not null"`
	DisabledWhenLimited          bool      `json:"disabledWhenLimited" gorm:"not null;default:false"`
	DisconnectUsersWhenLimited   bool      `json:"disconnectUsersWhenLimited" gorm:"not null;default:true"`
	DisconnectUsersWhenDisabled  bool      `json:"disconnectUsersWhenDisabled" gorm:"not null;default:true"`
	CreatedAt                    time.Time `json:"createdAt" gorm:"not null"`
	UpdatedAt                    time.Time `json:"updatedAt" gorm:"not null"`
}

func (ManagementAdminRole) TableName() string {
	return "management_admin_roles"
}

// ManagementAdmin stores credentials and status for non-native management
// accounts. NativeUserID is optional so the existing 3X-UI Owner can later be
// linked to its current native user without copying or replacing its password.
// PasswordHash and policy overrides are never included in JSON output.
type ManagementAdmin struct {
	ID                      int        `json:"id" gorm:"primaryKey;autoIncrement"`
	Username                string     `json:"username" gorm:"size:128;not null;uniqueIndex:ux_management_admins_username"`
	PasswordHash            string     `json:"-" gorm:"size:255;not null"`
	RoleID                  int        `json:"roleId" gorm:"not null;index:idx_management_admins_role_status,priority:1"`
	Status                  string     `json:"status" gorm:"size:16;not null;default:active;index:idx_management_admins_role_status,priority:2"`
	PermissionOverridesJSON string     `json:"-" gorm:"type:text;not null"`
	NativeUserID            *int       `json:"-" gorm:"uniqueIndex:ux_management_admins_native_user"`
	CreatedByAdminID        *int       `json:"-" gorm:"index"`
	LastLoginAt             *time.Time `json:"lastLoginAt,omitempty"`
	CreatedAt               time.Time  `json:"createdAt" gorm:"not null"`
	UpdatedAt               time.Time  `json:"updatedAt" gorm:"not null"`
}

func (ManagementAdmin) TableName() string {
	return "management_admins"
}
