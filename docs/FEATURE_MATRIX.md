# EL-UI Feature Compatibility Matrix

This is an initial planning matrix based on the upstream project descriptions. A feature is **not implemented** merely because it is listed here. Every row must be verified against source code and tests before its status changes.

Status meanings:
- **Audit pending** — source-level behavior and dependencies still need inspection.
- **Design pending** — integration approach not yet approved.
- **Not started** — no EL-UI implementation yet.
- **Verified** — implemented and backed by a reproducible test.

| Capability | 3X-UI baseline | HMPanel-described capability | Initial EL-UI status | Verification needed |
|---|---|---|---|---|
| Protocols, inbounds, Xray config | Core functionality | Uses native 3X-UI | Audit pending | Confirm upstream version, APIs, database schema, and update behavior |
| Clients and traffic limits | Per-client quota/expiry/IP controls | Client groups, reseller limits, multiple inbounds per client | Audit pending | Map client identities and limit semantics |
| Multi-panel / nodes | Multi-node support exists | Central management of multiple 3X-UI panels | Design pending | Determine whether to reuse native node support or add a separate control-plane registry |
| Reseller roles | Not equivalent to full reseller management | Multi-tier reseller permissions and limits | Design pending | Permission matrix, tenant isolation, authorization tests |
| Traffic accounting | Per-client and per-inbound statistics | Real-time accounting, grace periods, usage/allocation modes | Audit pending | Reconcile reset windows, polling, stale data, and billing invariants |
| Bulk operations | Some client/inbound workflows | Bulk edit/delete and migration workflows | Audit pending | Transaction boundaries, partial failures, dry-run and audit log |
| Backup / restore | Core database options and operational tools | Web-based PostgreSQL backup and restore | Audit pending | Authentication, file validation, encryption, rollback and restore tests |
| Migration | Existing panel migration docs/tools may apply | Legacy-panel migration engine | Audit pending | Supported source formats, idempotence, data validation |
| Dashboard / monitoring | Existing panel status and traffic views | Super-admin and infrastructure dashboards | Design pending | Define source of truth and freshness indicators |
| EL-UI rebrand and UI | Existing frontend | Separate management frontend | Not started | Preserve API contracts, responsive behavior, accessibility, RTL |
| Authentication / audit | Existing panel authentication | Management roles and administrative workflows | Audit pending | Session security, CSRF, rate limits, audit trail, least privilege |
| Installer / upgrades | Existing installer and service lifecycle | Separate installer/CLI/database stack | Design pending | Avoid conflicting services, ports, files, and destructive migrations |

## Initial conclusion

HMPanel describes itself as a management layer **on top of native 3X-UI**, not merely a visual theme. That makes a blind source merge risky. EL-UI should first define a stable integration boundary and then port/adapt capabilities in small, testable increments.

The exact status of every feature remains provisional until the corresponding implementation, schema, and tests have been inspected.


## Source-level findings

- 3X-UI already provides a Go-based native core, REST endpoints under `/panel/api`, scoped API tokens, CSRF middleware, native inbounds/clients, and local/remote node runtime behavior.
- HMPanel uses a separate PostgreSQL/Prisma data model for management entities and a separate NestJS/Next.js stack. This makes a blind code merge inappropriate.
- The HMPanel README says MIT, while `backend/package.json` declares `UNLICENSED` and the root LICENSE lookup did not find a file. Direct backend code reuse remains blocked pending license clarification.
- The repository includes `docs/SOURCE_AUDIT.md` with the current evidence and the remaining decision gates.
