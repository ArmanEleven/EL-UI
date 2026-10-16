<!--
EL-UI
Project lead and maintainer: ArmanEleven
This project builds on the Sanaei 3X-UI codebase. See LICENSE and upstream notices.
-->

<p align="center">
  <strong>EL-UI</strong>
</p>

<h1 align="center">EL-UI — Independent Control Plane for Secure Panel Operations</h1>

<p align="center">
  <em>Built with care by <a href="https://github.com/ArmanEleven">ArmanEleven</a></em>
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
  <img alt="Project status: experimental" src="https://img.shields.io/badge/status-experimental-orange">
  <img alt="Core: 3X-UI" src="https://img.shields.io/badge/core-3X--UI-blue">
  <img alt="License: GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-informational">
</p>

**EL-UI** is an open-source panel and control-plane project led by **ArmanEleven**. It is being developed as a distinct product with its own interface, administration model, and operational workflow, while retaining compatibility with the upstream [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) codebase where required. The upstream relationship is disclosed for attribution and compatibility; it is not the product's user-facing identity.

> [!WARNING]
> **EL-UI is under active development and is not a production-ready release.** The multi-admin management layer is not yet connected end-to-end to authentication, API authorization, and the user interface. Do not use this development branch to manage production servers or valuable data.

## Project goals

- **Preserve the core:** retain 3X-UI's existing Xray, inbound, client, subscription, traffic, and node workflows.
- **Real multi-admin support:** give each management account an independent identity, assigned role, status, and enforceable access scope.
- **Role-based permissions:** use explicit `NONE`, `OWN`, and `ALL` scopes, with denied-by-default authorization.
- **Enforce quotas on the server:** apply user-count, data-limit, expiry, HWID, and other configured limits in backend operations—not just in forms.
- **Keep ownership boundaries:** prevent an administrator from reading or changing records outside the scope granted to their role.
- **Make changes auditable and reversible:** introduce safe migrations, backup/restore checks, clear operational logs, and regression tests.
- **Build a distinctive product:** deliver an accessible, responsive EL-UI interface with internationalization, right-to-left support, and a consistent visual system.

## Current development status

The current work is happening on the `feature/rbac-foundation` branch.

| Area | Status |
|---|---|
| 3X-UI core source in the development branch | Present; full EL-UI release validation is pending |
| Initial RBAC domain types and permission checks | Added; local unit coverage is authored |
| Separate management admin/role database models | Added and registered for schema migration |
| SQLite ↔ PostgreSQL migration model list | Updated to include the new management tables |
| End-to-end admin login and session identity | Not implemented yet |
| Authorization enforced across real management APIs | Not implemented yet |
| Role/admin management UI | Not implemented yet |
| Full build, integration suite, and production upgrade validation | Pending |

A code change is not considered complete merely because its data model or UI exists. It must be connected to the application and supported by reproducible tests. The current branch's full CI status has not yet been verified.

## Planned capabilities

### 1. Administrators and roles

- An Owner account with full control.
- Independent secondary administrator accounts.
- Create, edit, disable, and manage administrator accounts.
- Create and edit roles with per-resource, per-action permissions.
- Support for `NONE`, `OWN`, and `ALL` access scopes.
- A dedicated administrator portal separated from Owner-only operations.

### 2. Limits and access policy

- Maximum number of users/clients per administrator.
- Minimum and maximum traffic/data limits and expiry ranges.
- HWID policy and per-user device limits where supported by the core.
- Optional group and template allow-lists.
- Defined behavior for limited or disabled administrator accounts.
- Server-side checks at write time, including boundary and concurrency tests.

### 3. Operations and reliability

- Audit events for sensitive administrative actions.
- Safe, versioned database migrations.
- Backup and restore tests before release.
- Cross-database migration coverage for SQLite and PostgreSQL.
- Integration tests for owner isolation, direct API requests, disabled accounts, and quota enforcement.
- Clear installation, upgrade, rollback, and troubleshooting documentation.

These are project targets, not a claim that every capability is already available.

## Architecture

EL-UI currently retains the upstream 3X-UI implementation as a compatibility foundation for Xray and existing panel operations. This is a documented technical dependency, not a claim that the upstream core has already been fully forked or renamed. Management policies must remain separated from core client and runtime logic.

- **Compatibility foundation:** [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) — retained for upstream attribution and compatibility with native Xray lifecycle, inbound, client, subscription, and node operations.
- **Protocol engine:** [Xray-core](https://github.com/XTLS/Xray-core).
- **Backend:** Go, Gin, and GORM.
- **Frontend:** React, TypeScript, Vite, and Ant Design.
- **Database options inherited from the core:** SQLite and PostgreSQL.
- **RBAC behavior reference:** publicly documented concepts from [PasarGuard](https://github.com/PasarGuard/panel). EL-UI's implementation is developed independently; this does not imply code reuse.

See the [architecture proposal](docs/ELUI-ARCHITECTURE.md), [source audit](docs/SOURCE_AUDIT.md), and [feature compatibility matrix](docs/FEATURE_MATRIX.md).

## Development

The exact toolchain should match the versions in the repository manifests. The current branch declares Go 1.27.2 and Node.js 26 or newer with npm 11 or newer.

Typical validation commands:

```bash
go test ./...
```

Frontend checks can be run from the `frontend/` directory:

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

These are contributor checks; they are **not** evidence that the complete current branch has already passed CI. Run tests against disposable databases and test servers. Never experiment with migrations on a production database.

## Security and data integrity

- Enforce permissions on the backend; hiding a button is not authorization.
- Apply ownership constraints to database queries, not only to individual UI screens.
- Do not log passwords, API tokens, subscription secrets, or unredacted sensitive data.
- Test migrations and restore procedures with disposable data before deployment.
- Preserve upstream copyright notices and comply with the applicable terms in [LICENSE](LICENSE).
- Report suspected vulnerabilities privately where possible; see [SECURITY.md](SECURITY.md).

## Project leadership and acknowledgements

**Project lead and maintainer:** [ArmanEleven](https://github.com/ArmanEleven).

EL-UI builds on work from the [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) and [Xray-core](https://github.com/XTLS/Xray-core) projects. Their maintainers and contributors deserve clear attribution. The project also studies publicly documented management behaviors from PasarGuard as a functional reference.

## License

EL-UI's distribution must preserve the upstream license requirements and notices. Review the repository's [LICENSE](LICENSE) before modifying or redistributing the project.

---

<p align="center">
  <sub>Designed and maintained by <a href="https://github.com/ArmanEleven">ArmanEleven</a> · Built incrementally, with correctness before claims.</sub>
</p>


## Command-line entry point

Use `el-ui` for panel operations on new installations:

```bash
el-ui status
el-ui restart
el-ui settings
```

The previous launcher remains an internal compatibility target during the migration. Service and storage identifiers will be migrated separately with an upgrade path that protects existing installations.
