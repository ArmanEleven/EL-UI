# EL-UI Architecture Decision Log

## ADR-001: Keep 3X-UI as the protocol core

- **Status:** Accepted for the initial implementation direction
- **Date:** 2026-10-11

### Context

Sanaei 3X-UI owns the native Xray lifecycle, inbound/client persistence, subscriptions, API, and local/remote runtime. HMPanel adds a separate management plane with its own NestJS backend, Next.js frontend, PostgreSQL/Prisma schema, and Redis-backed background jobs. These are not compatible as a single source tree without deliberate integration work.

### Decision

1. Use Sanaei 3X-UI as the protocol/Xray core.
2. Add EL-UI management features through an explicit adapter to the native 3X-UI API.
3. Keep reseller/tenant records, management policies, accounting records, and audit history separate from native Xray configuration state unless a specific field must be mirrored.
4. Build the EL-UI management UI against the management API; redesign the native 3X-UI UI separately or integrate it only after the core import is buildable.
5. Reimplement or adapt HMPanel-described behavior only after license and API-contract checks. Do not copy HMPanel backend source while its README license claim and package metadata disagree.

### Consequences

- The project must pin and import an exact 3X-UI revision before compiling.
- The adapter needs explicit timeouts, retries, normalized errors, version/capability checks, and contract tests.
- Accounting needs idempotent collection, explicit units, defined reset windows, and reconciliation rules.
- A two-service deployment may be needed initially; deployment complexity is accepted to avoid a risky blind merge.

### Rejected alternatives

- **Blind merge of HMPanel and 3X-UI:** rejected because runtime, frontend, persistence and job-processing assumptions differ.
- **Frontend-only rename:** rejected because it does not provide the requested management capabilities.
- **Direct writes to the 3X-UI database from a new service:** rejected as the default because it bypasses native service logic and can desynchronize Xray runtime state.
