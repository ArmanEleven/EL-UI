# EL-UI

**EL-UI** is a planned management panel built around the Sanaei 3X-UI core, with a redesigned interface and a management layer inspired by the capabilities of HMPanel.

> **Project status:** research and architecture phase. No upstream code has been merged into this repository yet. Do not use this repository as a production installer.

## Project goals

- Preserve the protocol, client, inbound, subscription, and Xray management capabilities provided by 3X-UI.
- Evaluate and adapt HMPanel-style capabilities: multi-panel management, reseller roles and limits, traffic accounting, bulk operations, backup/restore, and migration tooling.
- Replace the stock UI with a distinct EL-UI design without breaking existing API behavior.
- Keep upstream provenance, licenses, and required notices clear.
- Add tests and safe migration/backup paths before deployment.

## Upstream projects under review

- [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) — core panel and Xray integration; GPL-3.0.
- [HMPanel](https://github.com/neoauroraproject/hmpanel) — management layer; its README states MIT. The repository's actual license files and bundled dependencies still need a complete audit before code is reused.

## Work plan

1. **Source audit:** inspect architecture, dependencies, APIs, database models, install scripts, security boundaries, and licenses.
2. **Compatibility map:** document which HMPanel features can be integrated, adapted, or need a clean-room implementation.
3. **Architecture and proof of concept:** define the integration boundary and validate the smallest end-to-end flow.
4. **Implementation:** deliver one tested capability at a time.
5. **UI redesign:** implement EL-UI branding and responsive pages against stable API contracts.
6. **Validation and release:** test installation, upgrade, backup/restore, permissions, and failure recovery.

## Repository map

- `docs/FEATURE_MATRIX.md` — feature-by-feature integration status.
- `docs/ARCHITECTURE.md` — proposed component boundaries and safety principles.

## Safety and development rules

- Never commit real credentials, private keys, tokens, production databases, or unredacted server logs.
- Do not run upstream installation scripts on a production server as part of the audit.
- Test database migrations and restore procedures against disposable data first.
- Keep upstream code and notices attributable; review license compatibility before distributing a combined build.
- Mark a feature complete only after implementation and a reproducible test, not just because it appears in the UI.
