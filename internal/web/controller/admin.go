package controller

import (
 "errors"
 "net/http"
 "strconv"

 "github.com/gin-gonic/gin"
 "github.com/mhsanaei/3x-ui/v3/internal/web/service/panel"
 "github.com/mhsanaei/3x-ui/v3/internal/web/session"
 "gorm.io/gorm"
)

type AdminController struct{ service panel.AdminService }
type adminCreateRequest struct{
 Username string `json:"username" binding:"required"`
 Password string `json:"password" binding:"required"`
 MaxClients int `json:"maxClients"`
 AllowUnlimitedClients bool `json:"allowUnlimitedClients"`
 TrafficQuotaBytes int64 `json:"trafficQuotaBytes"`
 AllowUnlimitedTraffic bool `json:"allowUnlimitedTraffic"`
 AllowedInboundIDs []int `json:"allowedInboundIds"`
}
type adminUpdateRequest struct{
 Username *string `json:"username"`
 Password *string `json:"password"`
 Enabled bool `json:"enabled"`
 MaxClients int `json:"maxClients"`
 AllowUnlimitedClients bool `json:"allowUnlimitedClients"`
 TrafficQuotaBytes int64 `json:"trafficQuotaBytes"`
 AllowUnlimitedTraffic bool `json:"allowUnlimitedTraffic"`
 AllowedInboundIDs []int `json:"allowedInboundIds"`
}
func NewAdminController(g *gin.RouterGroup)*AdminController{
 a:=&AdminController{};r:=g.Group("/admins");r.GET("",a.list);r.GET("/me",a.me);r.POST("",a.create);r.PUT("/:id",a.update);r.POST("/:id",a.update);r.DELETE("/:id",a.delete);return a
}
func(a *AdminController)list(c *gin.Context){u:=session.GetLoginUser(c);if u==nil{c.AbortWithStatus(http.StatusUnauthorized);return};rows,err:=a.service.List(u.Id);if err!=nil{a.writeError(c,err);return};jsonObj(c,rows,nil)}
func(a *AdminController)me(c *gin.Context){
 u:=session.GetLoginUser(c);if u==nil{c.AbortWithStatus(http.StatusUnauthorized);return}
 if a.service.IsOwner(u.Id){jsonObj(c,gin.H{"userId":u.Id,"username":u.Username,"role":"owner"},nil);return}
 p,err:=a.service.GetProfile(u.Id);if err!=nil{a.writeError(c,err);return}
 jsonObj(c,gin.H{"userId":u.Id,"username":u.Username,"role":"admin","enabled":p.Enabled,"maxClients":p.MaxClients,"allowUnlimitedClients":p.AllowUnlimitedClients,"trafficQuotaBytes":p.TrafficQuotaBytes,"allowUnlimitedTraffic":p.AllowUnlimitedTraffic,"allowedInboundIds":p.AllowedInboundIDsJSON,"allocatedClients":p.AllocatedClients,"allocatedTrafficBytes":p.AllocatedTrafficBytes},nil)
}
func(a *AdminController)create(c *gin.Context){
 u:=session.GetLoginUser(c);if u==nil{c.AbortWithStatus(http.StatusUnauthorized);return};var req adminCreateRequest
 if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(http.StatusBadRequest,gin.H{"success":false,"msg":"داده‌های ادمین معتبر نیست"});return}
 id,err:=a.service.Create(u.Id,req.Username,req.Password,req.MaxClients,req.AllowUnlimitedClients,req.TrafficQuotaBytes,req.AllowUnlimitedTraffic,req.AllowedInboundIDs);if err!=nil{a.writeError(c,err);return}
 c.JSON(http.StatusCreated,gin.H{"success":true,"userId":id,"msg":"ادمین با موفقیت ساخته شد"})
}
func(a *AdminController)update(c *gin.Context){
 u:=session.GetLoginUser(c);if u==nil{c.AbortWithStatus(http.StatusUnauthorized);return};id,err:=strconv.Atoi(c.Param("id"));if err!=nil||id<=0{c.JSON(http.StatusBadRequest,gin.H{"success":false,"msg":"شناسه ادمین معتبر نیست"});return}
 var req adminUpdateRequest;if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(http.StatusBadRequest,gin.H{"success":false,"msg":"داده‌های ادمین معتبر نیست"});return}
 if err:=a.service.Update(u.Id,id,req.Username,req.Password,req.Enabled,req.MaxClients,req.AllowUnlimitedClients,req.TrafficQuotaBytes,req.AllowUnlimitedTraffic,req.AllowedInboundIDs);err!=nil{a.writeError(c,err);return}
 c.JSON(http.StatusOK,gin.H{"success":true,"msg":"تغییرات ادمین ذخیره شد"})
}
func(a *AdminController)delete(c *gin.Context){
 u:=session.GetLoginUser(c);if u==nil{c.AbortWithStatus(http.StatusUnauthorized);return};id,err:=strconv.Atoi(c.Param("id"));if err!=nil||id<=0{c.JSON(http.StatusBadRequest,gin.H{"success":false,"msg":"شناسه ادمین معتبر نیست"});return}
 if err:=a.service.Delete(u.Id,id);err!=nil{a.writeError(c,err);return};c.JSON(http.StatusOK,gin.H{"success":true,"msg":"ادمین حذف شد"})
}
func(a *AdminController)writeError(c *gin.Context,err error){
 status:=http.StatusInternalServerError;msg:="خطای داخلی سرور"
 switch{case errors.Is(err,panel.ErrAdminForbidden):status=http.StatusForbidden;msg="دسترسی کافی نیست";case errors.Is(err,panel.ErrAdminNotFound),errors.Is(err,gorm.ErrRecordNotFound):status=http.StatusNotFound;msg="ادمین پیدا نشد";case errors.Is(err,panel.ErrAdminInvalid):status=http.StatusBadRequest;msg=err.Error()}
 c.JSON(status,gin.H{"success":false,"msg":msg})
}
