# EL-UI Architecture (Initial Proposal)

## Current finding

The upstream projects serve different roles:

-  **Sanaei 3X-UI** is the Go-based core panel and Xray integration. Its current frontend manifest
  describes React 19, Ant Design 6, Vite 8, and TypeScript tooling. - **HMPanel** describes itself
  as a management layer built on native 3X-UI. Its repository has separate backend, frontend, Prisma
  schema, scripts, and deployment configuration. Its root package uses Prisma 5.

This suggests two possible strategies. The final choice must follow source-level compatibility and
license review, not assumptions.

## Strategy A — Native 3X-UI core plus an EL-UI management service

Keep the 3X-UI core responsible for Xray, inbounds, native clients, protocol configuration, and its
supported database/API behavior. Add an EL-UI management service for multi-panel orchestration,
reseller/tenant records, accounting policy, audit events, and management workflows. Connect them
through a narrowly scoped adapter.

**Advantages:** clearer separation of concerns and less invasive core maintenance.

**Risks:** two services and possibly two data stores; identity and traffic reconciliation must be
designed carefully.

## Strategy B — Adapt HMPanel's management layer to an EL-UI distribution

Reuse/adapt eligible HMPanel components while integrating them with a pinned 3X-UI version and
replacing the frontend branding.

**Advantages:** potentially faster for capabilities already implemented upstream.

**Risks:** upstream assumptions may not match the selected 3X-UI version; licensing and dependency
obligations need review; upgrades may require ongoing patch maintenance.

## Decision gate

Do not choose a strategy until these are checked:

1.  Pin exact upstream commits/releases and supported runtime versions. 2. Inspect HMPanel's actual
   3X-UI adapter/API calls and client identity model. 3. Inspect its Prisma schema, migrations,
   authentication, roles, and traffic-accounting implementation. 4. Inspect the 3X-UI API and
   database contract for the same pinned version. 5. Confirm licenses for source files and
   dependencies; preserve notices and meet obligations. 6. Build a capability-to-source map and a
   minimal end-to-end proof of concept.

## Proposed logical boundaries

-  **Core adapter:** typed, versioned interface to the chosen 3X-UI API; timeouts, retries, explicit
  error mapping, no broad database writes. - **Management domain:** panels/nodes, tenants/resellers,
  role assignments, quotas and policy configuration. - **Accounting service:** explicit units and
  reset windows, idempotent collection, reconciliation and auditable adjustments. - **Audit trail:**
  actor, action, target, timestamp, outcome, and redacted metadata for privileged operations. -
  **Web UI:** EL-UI branding, responsive layout, localization/RTL, role-aware navigation, and
  API-driven state. - **Operations:** installer, service supervision, migrations, health checks,
  backup/restore, upgrade/rollback.

These are target boundaries, not a claim that any of these components already exist.

## Security and data integrity guardrails

-  Enforce authorization on the server; hiding a button is not authorization. - Apply tenant scoping
  in every relevant query and mutation. - Treat upstream panel credentials and API tokens as
  secrets; store them securely and redact logs. - Use least privilege, input validation, CSRF
  protections where applicable, rate limiting, and secure session settings. - Make destructive/bulk
  operations previewable and auditable; prefer dry-run support. - Use transactions where possible
  and define recovery behavior for partial multi-panel failures. - Never overwrite a production
  database during testing. Verify backup integrity and restore into a disposable environment. -
  Avoid a second source of truth for client traffic without documented reconciliation rules.

## UI direction

The UI redesign should be implemented after the API/integration boundary is stable. Use a separate
EL-UI design system (tokens, typography, spacing, components, navigation, responsive breakpoints)
while preserving working backend behavior. The first UI milestone should be a tested shell and one
real data-driven page, not a static mock dashboard.

## Source-audit decision

The initial source review confirms that 3X-UI is a Go/Gin/GORM application with a React/Vite
frontend embedded into its Go binary. HMPanel is a separate NestJS/Node backend with a Next.js
frontend, a Prisma/PostgreSQL management schema, and Redis/Bull-based background work. Their
frontend and backend stacks are not a drop-in match.

**Recommended baseline:** retain Sanaei 3X-UI as the protocol/Xray core and add an EL-UI management
layer behind a narrowly scoped adapter. Do not blindly merge the two databases or service
lifecycles.

### Licensing gate

The HMPanel README says MIT, but the root LICENSE lookup did not find a license file and
`backend/package.json` says `UNLICENSED`. Until this discrepancy is resolved, direct reuse or
redistribution of HMPanel backend code is blocked. The feature requirements and public API behavior
can still guide an independent implementation. See [SOURCE_AUDIT.md](SOURCE_AUDIT.md).

### Existing related project

[ArmanEleven/ElevenPanel](https://github.com/ArmanEleven/ElevenPanel) is a separate related
repository with a similar management-layer direction. It must be inspected before duplicating
project-specific work, but no files will be merged from it automatically.
