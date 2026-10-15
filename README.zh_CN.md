<!--
EL-UI
项目负责人和维护者：ArmanEleven
本项目基于 Sanaei 3X-UI 代码库开发。请参阅 LICENSE 及上游版权声明。
-->

<p align="center">
  <strong>EL-UI</strong>
</p>

<h1 align="center">EL-UI — 面向 3X-UI 的角色权限管理层</h1>

<p align="center">
  <em>由 <a href="https://github.com/ArmanEleven">ArmanEleven</a> 创建并维护</em>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fa_IR.md">فارسی</a> ·
  <a href="README.it_IT.md">Italiano</a> ·
  <a href="README.zh_CN.md">简体中文</a> ·
  <a href="README.ru_RU.md">Русский</a> ·
  <a href="README.tr_TR.md">Türkçe</a>
</p>

<p align="center">
  <img alt="项目状态：实验阶段" src="https://img.shields.io/badge/status-experimental-orange">
  <img alt="核心：3X-UI" src="https://img.shields.io/badge/core-3X--UI-blue">
  <img alt="许可证：GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-informational">
</p>

**EL-UI** 是一个由 **ArmanEleven** 主导的开源项目，旨在基于 [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) 代码库，打造更清晰、更完善的管理体验。项目并不打算替换 Xray 协议引擎，而是保留原生面板的核心能力，并逐步构建独立的管理层，用于管理员、角色、权限、配额和运行状态管理。

> [!WARNING]
> **EL-UI 仍处于开发阶段，尚未发布可用于生产环境的版本。** 多管理员管理功能尚未完整接入身份验证、API 授权和用户界面。请勿使用当前开发分支管理生产服务器或重要数据。

## 项目目标

- **保留核心能力：** 继续支持 3X-UI 现有的 Xray、入站、客户端、订阅、流量和节点工作流。
- **真正的多管理员：** 为每位管理员提供独立身份、角色、状态和可强制执行的访问范围。
- **基于角色的权限控制：** 使用明确的 `NONE`、`OWN` 和 `ALL` 范围；未明确授权的操作默认拒绝。
- **在服务端执行配额：** 在后端操作中落实用户数、流量、到期时间、HWID 等限制，而不仅是在表单中展示限制。
- **隔离数据所有权：** 防止管理员读取或修改超出其角色授权范围的数据。
- **可审计、可恢复的变更：** 引入安全迁移、备份与恢复检查、清晰的运行日志和回归测试。
- **独立的现代界面：** 构建易用、响应式、多语言并支持从右向左布局的管理界面。

## 当前开发状态

当前开发工作位于 `feature/rbac-foundation` 分支。

| 模块 | 状态 |
|---|---|
| 开发分支中的 3X-UI 核心源码 | 已存在；EL-UI 完整发布验证仍待完成 |
| 初始 RBAC 领域模型和权限检查 | 已添加；已编写单元测试 |
| 独立的管理角色和管理员数据库模型 | 已添加并注册到 schema 迁移 |
| SQLite ↔ PostgreSQL 跨数据库迁移模型清单 | 已加入新的管理表 |
| 管理员独立登录和会话身份 | 尚未实现 |
| 在真实管理 API 中强制执行权限 | 尚未实现 |
| 角色和管理员管理界面 | 尚未实现 |
| 完整构建、集成测试和安全升级验证 | 待执行 |

仅有数据库模型或界面并不代表功能已经完成。每项功能都必须接入应用，并通过可重复执行的测试。当前分支的完整 CI 状态尚未得到验证。

## 计划中的功能

### 1. 管理员与角色

- 具有完整控制权的 Owner 账户。
- 独立的次级管理员账户。
- 创建、编辑、禁用和管理管理员账户。
- 按资源和操作分别配置权限的角色管理。
- 支持 `NONE`、`OWN` 和 `ALL` 访问范围。
- 独立的管理员门户，与 Owner 专属操作隔离。

### 2. 限额与访问策略

- 为每位管理员设置可创建的用户/客户端数量上限。
- 配置流量/数据限额、到期范围的最小值和最大值。
- 在核心支持的范围内配置 HWID 策略和每用户设备限制。
- 限制可使用的用户组和模板。
- 明确定义受限或已禁用管理员的行为。
- 在服务端执行所有限制，并测试边界值和并发请求。

### 3. 运维与可靠性

- 记录敏感的管理员操作事件。
- 安全、带版本号的数据库迁移。
- 发布前进行备份和恢复测试。
- 覆盖 SQLite 与 PostgreSQL 之间的数据迁移。
- 测试直接 API 调用、跨管理员数据隔离、禁用账户和配额执行。
- 提供清晰的安装、升级、回滚和故障排查文档。

以上是项目目标，并不表示所有功能都已经可用。

## 架构

EL-UI 使用原生 3X-UI 代码作为协议和 Xray 核心。计划中的管理层会设置明确的边界，避免管理策略绕过核心客户端逻辑或运行时管理机制。

- **核心面板：** [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) — Xray 生命周期、入站、客户端、订阅和节点操作。
- **协议引擎：** [Xray-core](https://github.com/XTLS/Xray-core)。
- **后端：** Go、Gin 和 GORM。
- **前端：** React、TypeScript、Vite 和 Ant Design。
- **从核心继承的数据库选项：** SQLite 和 PostgreSQL。
- **RBAC 行为参考：** [PasarGuard](https://github.com/PasarGuard/panel) 中公开文档化的设计概念。EL-UI 独立实现相关行为；这不表示复用 PasarGuard 的源代码。

更多信息请参阅[架构方案](docs/ELUI-ARCHITECTURE.md)、[源码审计](docs/SOURCE_AUDIT.md)和[功能兼容性矩阵](docs/FEATURE_MATRIX.md)。

## 开发

开发工具版本应与仓库中的 manifest 保持一致。当前分支声明使用 Go 1.27.2；前端要求 Node.js 26 或更高版本，以及 npm 11 或更高版本。

Go 测试命令：

```bash
go test ./...
```

在 `frontend/` 目录中执行前端检查：

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

这些是建议的开发者检查命令，**不代表当前分支已经通过全部 CI 流程**。请在临时数据库和测试服务器上执行测试，不要在生产数据库上试验迁移。

## 安全与数据完整性

- 必须在后端执行权限检查；隐藏按钮不等于授权。
- 必须在数据库查询中执行所有权过滤，而不仅是在界面中隐藏记录。
- 不要将密码、API 令牌、订阅密钥或未脱敏的敏感信息写入日志。
- 部署前应使用测试数据验证迁移和恢复流程。
- 保留上游版权声明并遵守适用的许可证要求；请阅读 [LICENSE](LICENSE)。
- 尽可能通过私密渠道报告疑似安全漏洞；参阅 [SECURITY.md](SECURITY.md)。

## 项目负责人与致谢

**项目负责人和维护者：** [ArmanEleven](https://github.com/ArmanEleven)。

EL-UI 建立在 [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) 和 [Xray-core](https://github.com/XTLS/Xray-core) 项目的成果之上。我们重视对其维护者和贡献者的明确致谢。PasarGuard 公开记录的管理行为也作为功能设计参考进行研究。

## 许可证

分发 EL-UI 时必须保留上游许可证要求和版权声明。修改或重新分发本项目之前，请阅读仓库中的 [LICENSE](LICENSE)。

---

<p align="center">
  <sub>由 <a href="https://github.com/ArmanEleven">ArmanEleven</a> 设计并维护 · 循序开发，以可验证的正确性为先。</sub>
</p>
