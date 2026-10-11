# Source Audit — Phase 1

Audit date: 2026-10-11  
Status: **initial source review completed; full compatibility validation remains a later engineering task.**

## Repositories and evidence reviewed

- [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui)
  - `go.mod`: Go module `github.com/mhsanaei/3x-ui/v3`, uses Gin, GORM, SQLite/PostgreSQL drivers, Xray libraries and other runtime dependencies.
  - `docs/architecture.md`: describes Go as the backend source of truth, a React/Vite SPA embedded in the Go binary, a separate subscription server, and a runtime abstraction for local/remote nodes.
  - `internal/web/controller/api.go`: confirms API routes under `/panel/api`, token scopes, CSRF middleware, and native routes for inbounds, clients, server, nodes, and hosts.
  - `frontend/package.json`: React 19, Ant Design 6, Vite 8, TypeScript, React Router, TanStack Query, Zod, and Vitest scripts.
  - The repository identifies its license as GPL-3.0.

- [HMPanel](https://github.com/neoauroraproject/hmpanel)
  - `README.md`: describes HMPanel as a management layer on top of native 3X-UI, with multi-panel/reseller management, advanced traffic accounting, bulk operations, migration, and backup/restore.
  - `prisma/schema.prisma`: defines a separate PostgreSQL management database with Server, Panel, Admin, Inbound, Client and related models; includes reseller roles, quota/traffic modes, panel capability metadata and audit-related relations.
  - `backend/package.json`: NestJS 11 / TypeScript backend with JWT/passport, Bull/Redis, Socket.IO, Axios, Prisma-related tooling and Jest. Notably, the package metadata says `"license": "UNLICENSED"`.
  - `frontend/package.json`: Next.js 16, React 19, Tailwind CSS 4, Zustand, TanStack Query, Recharts and Socket.IO client.
  - `docker-compose.yml` and `.env.example`: deploys app + PostgreSQL + Redis; expects JWT/database/admin secrets. Compose mounts the Docker socket, which is a high-privilege capability and must not be copied without a deliberate threat review.
  - The README states MIT, but a root `LICENSE` file was not found by the connected repository file lookup. This conflicts with the backend package's `UNLICENSED` metadata; do not copy/re-distribute HMPanel backend source until its applicable license and provenance are clarified.

- [ArmanEleven/ElevenPanel](https://github.com/ArmanEleven/ElevenPanel)
  - This is a separate repository, not the target EL-UI repository. Its README describes a similar management-layer direction and its `go.mod` declares a Go module.
  - It should be reviewed as a potentially relevant existing project before duplicating effort, but it will not be merged into EL-UI automatically.

## Main compatibility finding

The codebases are not drop-in compatible:

| Concern | 3X-UI | HMPanel |
|---|---|---|
| Core runtime | Go service, Gin, GORM | Separate NestJS/Node management API |
| Web frontend | React + Vite + Ant Design; built assets embedded in Go | Next.js + React + Tailwind |
| Management data | Native panel database and APIs | Separate PostgreSQL/Prisma schema |
| Background work | Go-managed jobs and panel runtime | NestJS scheduling/queues, Redis/Bull |
| Integration | Native REST API and local/remote node runtime | Adapter calls to 3X-UI APIs and synchronization |

A visual-only rebrand will not provide HMPanel's management capabilities. A blind merge would also create duplicated data models, runtime assumptions, and upgrade risk.

## Recommended direction

Use **Sanaei 3X-UI as the protocol/Xray core** and define EL-UI's management layer behind an explicit adapter. Reuse public feature requirements and verified API contracts. Any direct reuse of HMPanel code is blocked pending a clear license review; where needed, implement compatible behavior independently rather than copying uncertainly licensed source.

For the frontend, keep EL-UI's management screens distinct from the embedded native panel until the integration design proves whether to use a single frontend build or a separate management UI. Preserve upstream attribution and GPL obligations for any derivative 3X-UI distribution.

## Remaining checks before implementation

- Pin exact upstream commits/releases instead of tracking moving `main` branches.
- Map every HMPanel operation to exact 3X-UI API endpoints and request/response contracts.
- Audit schema migrations and data ownership for panels, clients, inbounds, traffic, quotas and reseller permissions.
- Review auth/session/CSRF and secret handling in both projects.
- Inspect the existing ElevenPanel repository to determine whether it contains reusable project-specific work.
- Decide and document the license/distribution strategy before bundling or redistributing source.
- Implement a disposable-environment proof of concept; do not test migrations against production data.
