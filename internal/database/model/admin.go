package model

import "time"

// AdminProfile contains limits for a secondary administrator. The primary owner
// is the first User row and intentionally has no profile.
type AdminProfile struct {
 UserID int `json:"userId" gorm:"primaryKey;column:user_id"`
 Enabled bool `json:"enabled" gorm:"not null;default:true"`
 MaxClients int `json:"maxClients" gorm:"column:max_clients;not null;default:0"`
 AllowUnlimitedClients bool `json:"allowUnlimitedClients" gorm:"column:allow_unlimited_clients;not null;default:false"`
 TrafficQuotaBytes int64 `json:"trafficQuotaBytes" gorm:"column:traffic_quota_bytes;not null;default:0"`
 AllowUnlimitedTraffic bool `json:"allowUnlimitedTraffic" gorm:"column:allow_unlimited_traffic;not null;default:false"`
 AllowedInboundIDsJSON string `json:"-" gorm:"column:allowed_inbound_ids;type:text;not null;default:'[]'"`
 AllocatedClients int `json:"allocatedClients" gorm:"column:allocated_clients;not null;default:0"`
 AllocatedTrafficBytes int64 `json:"allocatedTrafficBytes" gorm:"column:allocated_traffic_bytes;not null;default:0"`
 CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
 UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}
func (AdminProfile) TableName() string { return "admin_profiles" }

// ClientOwnership assigns each client record to at most one secondary admin.
type ClientOwnership struct {
 ClientEmail string `json:"clientEmail" gorm:"primaryKey;column:client_email"`
 AdminUserID int `json:"adminUserId" gorm:"column:admin_user_id;not null;index"`
 CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}
func (ClientOwnership) TableName() string { return "client_ownership" }

// AdminAuditLog stores sanitized metadata for privileged account-management events.
type AdminAuditLog struct {
 ID uint `json:"id" gorm:"primaryKey;autoIncrement"`
 ActorID int `json:"actorId" gorm:"column:actor_id;not null;index"`
 Action string `json:"action" gorm:"not null;index"`
 TargetID int `json:"targetId" gorm:"column:target_id;not null;default:0;index"`
 Details string `json:"details" gorm:"type:text;not null;default:'{}'"`
 CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;index"`
}
func (AdminAuditLog) TableName() string { return "admin_audit_logs" }
