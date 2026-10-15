package model

import "time"

// ManagementAdminClient assigns a native client identity to exactly one
// management administrator. Client payloads and credentials remain in the
// existing clients table; this table contains ownership metadata only.
type ManagementAdminClient struct {
	ID                 int       `json:"-" gorm:"primaryKey;autoIncrement"`
	ManagementAdminID  int       `json:"-" gorm:"not null;index:idx_management_admin_clients_admin"`
	Email              string    `json:"-" gorm:"size:128;not null;uniqueIndex:ux_management_admin_clients_email"`
	CreatedAt          time.Time `json:"-" gorm:"not null"`
}

func (ManagementAdminClient) TableName() string {
	return "management_admin_clients"
}
