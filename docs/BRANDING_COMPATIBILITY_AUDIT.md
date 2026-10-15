# EL-UI Branding and Compatibility Audit

> Status: in progress. This document records verified findings from the identity-redesign branch; it is not a release-readiness claim.

## Product-facing identity

The user-facing product name is **EL-UI**. The frontend HTML entry documents use the EL-UI title, application name, description, and dark forest theme color. The main frontend entry imports `@/styles/elui-identity.css`, `@/styles/page-shell.css`, and `@/styles/page-cards.css`, so those identity styles are in the active bundle entry rather than being orphaned files.

The English and Persian README headings and product descriptions now present EL-UI as an independent product with a disclosed upstream compatibility foundation. Upstream attribution remains explicit and must not be removed.

## Verified compatibility dependencies to retain for now

| Identifier / dependency | Current role | Decision |
| --- | --- | --- |
| `/usr/local/x-ui` | Default installation/storage path used by legacy scripts | Keep until an explicit, tested migration copies or references existing data safely. |
| `XUI_MAIN_FOLDER`, `XUI_SERVICE`, other `XUI_*` variables | Existing installer/runtime configuration contract | Keep as compatibility variables. Add EL-UI aliases only with defined precedence and regression tests. |
| `/etc/systemd/system` and existing service unit names | Service installation/upgrade target | Inspect actual unit names and migration behavior before renaming. Never create a second competing service accidentally. |
| `x-ui.sh` and the internal `x-ui` executable target | Existing CLI implementation / compatibility target | Keep as implementation compatibility for now; expose `el-ui` as the documented user-facing command. |
| `github.com/mhsanaei/3x-ui/v3/...` Go import paths | Go module and upstream package identity | Do not mass-rewrite imports without a coordinated module/package migration and full Go build/test validation. |
| Upstream source and release URLs | Current installer/updater acquisition path | Treat as a material release dependency, not a completed EL-UI release pipeline. Do not replace with guessed EL-UI release URLs. |
| Upstream attribution, license notices, compatibility docs | Legal and technical provenance | Retain and make clear; this is not a user-facing product-label defect. |

## Known gaps requiring follow-up

1. The installer and updater still use legacy storage/configuration identifiers. A safe migration needs to detect existing paths, preserve user overrides, avoid overwriting data, and support rollback.
2. The repository's install/update scripts still need a dedicated audit of release URL construction, release asset names, checksum/signature validation, error text, and whether links point to actual EL-UI artifacts or upstream artifacts.
3. `x-ui.sh` is still the large legacy CLI implementation. A complete CLI rename must preserve old invocation behavior, systemd integration, scripts that call it, and existing installations.
4. Go source still imports the upstream module path. This is internal build identity and should not be rewritten as a cosmetic string replacement.
5. README files in other languages, translation catalogs, help text, and all UI strings still need a repository-wide, language-by-language audit. This document does not claim those surfaces are fully rebranded.
6. Release ownership and update strategy need an explicit decision before changing the updater from upstream release assets to EL-UI release assets. Until EL-UI publishes compatible signed/versioned artifacts, an upstream dependency must remain clearly disclosed.

## Safe migration rules

- Do not rename storage paths, environment variables, service units, database files, or API routes by search-and-replace.
- If adding EL-UI environment aliases, preserve old variables and define deterministic precedence; test both old-only and new-only configurations.
- If changing storage/service names, make the migration idempotent, preserve ownership and permissions, back up relevant state, detect conflicts, and document rollback.
- Validate install, in-place update, restart, uninstall, backup/restore, and upgrade from an existing legacy installation on disposable Linux VMs before calling the migration complete.
- Never describe queued or in-progress CI as passed. Record each workflow and job's actual conclusion for the exact head commit.

## Validation status

The identity stylesheet imports were verified in `frontend/src/main.tsx`. At the time this document was added, the latest observed GitHub Actions CI run for the redesign branch was queued; frontend format, lint, typecheck, tests, build, Go tests, and installation/upgrade smoke tests are therefore not reported as passed here.
