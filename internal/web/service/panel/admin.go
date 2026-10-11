package panel

import (
 "encoding/json"
 "errors"
 "fmt"
 "strings"
 "time"

 "github.com/mhsanaei/3x-ui/v3/internal/database"
 "github.com/mhsanaei/3x-ui/v3/internal/database/model"
 "github.com/mhsanaei/3x-ui/v3/internal/util/crypto"
 "gorm.io/gorm"
)

var (
 ErrAdminForbidden = errors.New("only the primary owner may manage administrators")
 ErrAdminNotFound = errors.New("administrator not found")
 ErrAdminInvalid = errors.New("invalid administrator data")
)

type AdminService struct{}
type AdminView struct {
 UserID int `json:"userId"`
 Username string `json:"username"`
 Enabled bool `json:"enabled"`
 MaxClients int `json:"maxClients"`
 AllowUnlimitedClients bool `json:"allowUnlimitedClients"`
 TrafficQuotaBytes int64 `json:"trafficQuotaBytes"`
 AllowUnlimitedTraffic bool `json:"allowUnlimitedTraffic"`
 AllowedInboundIDs []int `json:"allowedInboundIds"`
 AllocatedClients int `json:"allocatedClients"`
 AllocatedTrafficBytes int64 `json:"allocatedTrafficBytes"`
 CreatedAt time.Time `json:"createdAt"`
 UpdatedAt time.Time `json:"updatedAt"`
}

func (s *AdminService) IsOwner(userID int) bool {
 if userID <= 0 { return false }
 var first model.User
 return database.GetDB().Order("id ASC").First(&first).Error == nil && first.Id == userID
}
func (s *AdminService) GetProfile(userID int) (*model.AdminProfile,error) {
 p:=&model.AdminProfile{}
 if err:=database.GetDB().Where("user_id = ?",userID).First(p).Error;err!=nil{return nil,err}
 return p,nil
}
func (s *AdminService) List(actorID int) ([]AdminView,error) {
 if !s.IsOwner(actorID){return nil,ErrAdminForbidden}
 type row struct {
  UserID int `gorm:"column:user_id"`; Username string; Enabled bool
  MaxClients int; AllowUnlimitedClients bool; TrafficQuotaBytes int64
  AllowUnlimitedTraffic bool; AllowedInboundIDsJSON string
  AllocatedClients int; AllocatedTrafficBytes int64; CreatedAt time.Time; UpdatedAt time.Time
 }
 var rows []row
 err:=database.GetDB().Table("users AS u").Select("u.id AS user_id, u.username, p.enabled, p.max_clients, p.allow_unlimited_clients, p.traffic_quota_bytes, p.allow_unlimited_traffic, p.allowed_inbound_ids AS allowed_inbound_ids_json, p.allocated_clients, p.allocated_traffic_bytes, p.created_at, p.updated_at").Joins("JOIN admin_profiles p ON p.user_id = u.id").Order("u.id ASC").Scan(&rows).Error
 if err!=nil{return nil,err}
 out:=make([]AdminView,0,len(rows))
 for _,r:=range rows { ids:=[]int{}; _=json.Unmarshal([]byte(r.AllowedInboundIDsJSON),&ids); out=append(out,AdminView{UserID:r.UserID,Username:r.Username,Enabled:r.Enabled,MaxClients:r.MaxClients,AllowUnlimitedClients:r.AllowUnlimitedClients,TrafficQuotaBytes:r.TrafficQuotaBytes,AllowUnlimitedTraffic:r.AllowUnlimitedTraffic,AllowedInboundIDs:ids,AllocatedClients:r.AllocatedClients,AllocatedTrafficBytes:r.AllocatedTrafficBytes,CreatedAt:r.CreatedAt,UpdatedAt:r.UpdatedAt}) }
 return out,nil
}
func (s *AdminService) Create(actorID int, username,password string,maxClients int,allowUnlimitedClients bool,trafficQuotaBytes int64,allowUnlimitedTraffic bool,inboundIDs []int)(int,error){
 if !s.IsOwner(actorID){return 0,ErrAdminForbidden}
 username=strings.TrimSpace(username)
 if username==""||len(password)<10||maxClients<0||trafficQuotaBytes<0{return 0,ErrAdminInvalid}
 if maxClients==0&&!allowUnlimitedClients{return 0,fmt.Errorf("%w: تعداد کاربر باید محدود شود یا نامحدود صریحاً مجاز باشد",ErrAdminInvalid)}
 if trafficQuotaBytes==0&&!allowUnlimitedTraffic{return 0,fmt.Errorf("%w: سهمیه ترافیک باید مشخص باشد یا نامحدود صریحاً مجاز باشد",ErrAdminInvalid)}
 for _,id:=range inboundIDs{if id<=0{return 0,ErrAdminInvalid}}
 idsJSON,err:=json.Marshal(uniquePositiveInts(inboundIDs));if err!=nil{return 0,err}
 hash,err:=crypto.HashPasswordAsBcrypt(password);if err!=nil{return 0,err}
 newID:=0
 err=database.GetDB().Transaction(func(tx *gorm.DB)error{
  var count int64
  if err:=tx.Model(&model.User{}).Where("username = ?",username).Count(&count).Error;err!=nil{return err}
  if count>0{return fmt.Errorf("%w: نام کاربری تکراری است",ErrAdminInvalid)}
  u:=model.User{Username:username,Password:hash}
  if err:=tx.Create(&u).Error;err!=nil{return err}
  p:=model.AdminProfile{UserID:u.Id,Enabled:true,MaxClients:maxClients,AllowUnlimitedClients:allowUnlimitedClients,TrafficQuotaBytes:trafficQuotaBytes,AllowUnlimitedTraffic:allowUnlimitedTraffic,AllowedInboundIDsJSON:string(idsJSON)}
  if err:=tx.Create(&p).Error;err!=nil{return err}
  newID=u.Id
  return writeAdminAudit(tx,actorID,"admin.create",u.Id,map[string]any{"username":username})
 })
 return newID,err
}
func (s *AdminService) Update(actorID,targetID int,username,password *string,enabled bool,maxClients int,allowUnlimitedClients bool,trafficQuotaBytes int64,allowUnlimitedTraffic bool,inboundIDs []int)error{
 if !s.IsOwner(actorID){return ErrAdminForbidden}
 if targetID<=0||maxClients<0||trafficQuotaBytes<0{return ErrAdminInvalid}
 if maxClients==0&&!allowUnlimitedClients{return ErrAdminInvalid}
 if trafficQuotaBytes==0&&!allowUnlimitedTraffic{return ErrAdminInvalid}
 for _,id:=range inboundIDs{if id<=0{return ErrAdminInvalid}}
 idsJSON,err:=json.Marshal(uniquePositiveInts(inboundIDs));if err!=nil{return err}
 return database.GetDB().Transaction(func(tx *gorm.DB)error{
  p:=&model.AdminProfile{}
  if err:=tx.Where("user_id = ?",targetID).First(p).Error;err!=nil{if errors.Is(err,gorm.ErrRecordNotFound){return ErrAdminNotFound};return err}
  if username!=nil{name:=strings.TrimSpace(*username);if name==""{return ErrAdminInvalid};var count int64;if err:=tx.Model(&model.User{}).Where("username = ? AND id <> ?",name,targetID).Count(&count).Error;err!=nil{return err};if count>0{return fmt.Errorf("%w: نام کاربری تکراری است",ErrAdminInvalid)};if err:=tx.Model(&model.User{}).Where("id = ?",targetID).Update("username",name).Error;err!=nil{return err}}
  if password!=nil&&*password!=""{if len(*password)<10{return ErrAdminInvalid};hash,err:=crypto.HashPasswordAsBcrypt(*password);if err!=nil{return err};if err:=tx.Model(&model.User{}).Where("id = ?",targetID).Updates(map[string]any{"password":hash,"login_epoch":gorm.Expr("login_epoch + 1")}).Error;err!=nil{return err}}
  if p.AllocatedClients>maxClients&&!allowUnlimitedClients{return fmt.Errorf("%w: سقف جدید از تخصیص فعلی کمتر است",ErrAdminInvalid)}
  if p.AllocatedTrafficBytes>trafficQuotaBytes&&!allowUnlimitedTraffic{return fmt.Errorf("%w: سهمیه جدید از تخصیص فعلی کمتر است",ErrAdminInvalid)}
  if err:=tx.Model(p).Updates(map[string]any{"enabled":enabled,"max_clients":maxClients,"allow_unlimited_clients":allowUnlimitedClients,"traffic_quota_bytes":trafficQuotaBytes,"allow_unlimited_traffic":allowUnlimitedTraffic,"allowed_inbound_ids":string(idsJSON)}).Error;err!=nil{return err}
  return writeAdminAudit(tx,actorID,"admin.update",targetID,map[string]any{"enabled":enabled,"maxClients":maxClients,"allowUnlimitedClients":allowUnlimitedClients,"trafficQuotaBytes":trafficQuotaBytes,"allowUnlimitedTraffic":allowUnlimitedTraffic})
 })
}
func (s *AdminService) Delete(actorID,targetID int)error{
 if !s.IsOwner(actorID){return ErrAdminForbidden};if targetID<=0||targetID==actorID{return ErrAdminInvalid}
 return database.GetDB().Transaction(func(tx *gorm.DB)error{
  var p model.AdminProfile;if err:=tx.Where("user_id = ?",targetID).First(&p).Error;err!=nil{if errors.Is(err,gorm.ErrRecordNotFound){return ErrAdminNotFound};return err}
  if err:=writeAdminAudit(tx,actorID,"admin.delete",targetID,map[string]any{"username":"removed"});err!=nil{return err}
  if err:=tx.Where("admin_user_id = ?",targetID).Delete(&model.ClientOwnership{}).Error;err!=nil{return err}
  if err:=tx.Delete(&model.AdminProfile{},"user_id = ?",targetID).Error;err!=nil{return err}
  return tx.Delete(&model.User{},"id = ?",targetID).Error
 })
}
func (s *AdminService) IsEnabledAdmin(userID int)(bool,error){p,err:=s.GetProfile(userID);if errors.Is(err,gorm.ErrRecordNotFound){return false,nil};if err!=nil{return false,err};return p.Enabled,nil}
func (s *AdminService) OwnsClient(userID int,email string)(bool,error){var n int64;err:=database.GetDB().Model(&model.ClientOwnership{}).Where("admin_user_id = ? AND client_email = ?",userID,email).Count(&n).Error;return n==1,err}
func (s *AdminService) OwnedEmails(userID int)(map[string]struct{},error){var rows []model.ClientOwnership;if err:=database.GetDB().Where("admin_user_id = ?",userID).Find(&rows).Error;err!=nil{return nil,err};out:=make(map[string]struct{},len(rows));for _,r:=range rows{out[r.ClientEmail]=struct{}{}};return out,nil}
func (s *AdminService) CanCreateClient(userID int,totalBytes int64)error{
 p,err:=s.GetProfile(userID);if err!=nil{return err};if !p.Enabled{return ErrAdminForbidden};if totalBytes<=0&&!p.AllowUnlimitedTraffic{return fmt.Errorf("%w: نامحدود مجاز نیست",ErrAdminInvalid)}
 return database.GetDB().Transaction(func(tx *gorm.DB)error{
  q:=tx.Model(&model.AdminProfile{}).Where("user_id = ? AND enabled = ?",userID,true)
  if !p.AllowUnlimitedClients{q=q.Where("allocated_clients < max_clients")}
  if !p.AllowUnlimitedTraffic&&totalBytes>0{q=q.Where("allocated_traffic_bytes + ? <= traffic_quota_bytes",totalBytes)}
  upd:=map[string]any{"allocated_clients":gorm.Expr("allocated_clients + 1")};if totalBytes>0{upd["allocated_traffic_bytes"]=gorm.Expr("allocated_traffic_bytes + ?",totalBytes)}
  res:=q.Updates(upd);if res.Error!=nil{return res.Error};if res.RowsAffected!=1{return fmt.Errorf("%w: سهمیه تمام شده یا حساب غیرفعال است",ErrAdminInvalid)};return nil
 })
}
func (s *AdminService) ReleaseClientReservation(userID int,totalBytes int64)error{return database.GetDB().Model(&model.AdminProfile{}).Where("user_id = ? AND allocated_clients > 0",userID).Updates(map[string]any{"allocated_clients":gorm.Expr("CASE WHEN allocated_clients > 0 THEN allocated_clients - 1 ELSE 0 END"),"allocated_traffic_bytes":gorm.Expr("CASE WHEN allocated_traffic_bytes >= ? THEN allocated_traffic_bytes - ? ELSE 0 END",adminMaxInt64(totalBytes,0),adminMaxInt64(totalBytes,0))}).Error}
func (s *AdminService) AssignClient(userID int,email string)error{return database.GetDB().Create(&model.ClientOwnership{ClientEmail:email,AdminUserID:userID}).Error}
func (s *AdminService) IsInboundAllowed(userID,inboundID int)(bool,error){p,err:=s.GetProfile(userID);if err!=nil{return false,err};var ids []int;if err:=json.Unmarshal([]byte(p.AllowedInboundIDsJSON),&ids);err!=nil{return false,err};for _,id:=range ids{if id==inboundID{return true,nil}};return false,nil}
func writeAdminAudit(tx *gorm.DB,actorID int,action string,targetID int,details map[string]any)error{b,err:=json.Marshal(details);if err!=nil{return err};return tx.Create(&model.AdminAuditLog{ActorID:actorID,Action:action,TargetID:targetID,Details:string(b)}).Error}
func uniquePositiveInts(ids []int)[]int{seen:=map[int]struct{}{};out:=make([]int,0,len(ids));for _,id:=range ids{if id>0{if _,ok:=seen[id];!ok{seen[id]=struct{}{};out=append(out,id)}}};return out}
func adminMaxInt64(a,b int64)int64{if a>b{return a};return b}
