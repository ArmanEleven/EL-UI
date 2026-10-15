# Inbound settings capability audit

Scope: EL-UI's real inbound editor and management flow. This is a coverage map, not a claim that every option has already passed an end-to-end server test.

## Existing implementation areas

| Capability area | Implementation | Existing automated coverage / validation |
| --- | --- | --- |
| Inbound list, row actions, import/export, clone and details | `frontend/src/pages/inbounds/InboundsPage.tsx`, `frontend/src/pages/inbounds/list/`, `frontend/src/pages/inbounds/info/` | `frontend/src/test/clone-inbound-modal.test.tsx`, `frontend/src/test/inbound-clone.test.ts` |
| General fields and protocol-specific settings | `frontend/src/pages/inbounds/form/InboundFormModal.tsx`, `frontend/src/pages/inbounds/form/protocols/` | `frontend/src/test/inbound-form-modal.test.tsx`, `frontend/src/test/inbound-defaults.test.ts` |
| Transport/network settings | `frontend/src/pages/inbounds/form/transport/` | `frontend/src/test/inbound-form-blocks.test.tsx`, full inbound fixtures |
| TLS certificates and TLS settings | `frontend/src/pages/inbounds/form/security/tls.tsx` | `frontend/src/test/inbound-tls-validation.test.ts` |
| REALITY, target scanning and key helpers | `frontend/src/pages/inbounds/form/security/reality.tsx`, `RealityTargetScannerModal.tsx` | `frontend/src/test/reality-mldsa-cert-chain.test.tsx` |
| Sniffing | `frontend/src/pages/inbounds/form/SniffingTab.tsx` | `frontend/src/test/sniffing-field-resync.test.tsx` |
| Fallback rows | `frontend/src/pages/inbounds/form/FallbacksCard.tsx`, `useInboundFallbacks.ts` | Add/extend focused tests during the audit |
| Full and focused JSON editors | `frontend/src/pages/inbounds/form/advanced-editors.tsx` | Add explicit UI round-trip and invalid-JSON regression coverage during the audit |
| Form-to-wire conversion and DB restoration | `frontend/src/lib/xray/inbound-form-adapter.ts`, `inbound-from-db.ts` | `frontend/src/test/inbound-form-adapter.test.ts`, `inbound-from-db.test.ts`, `inbound-full.test.ts` |

## Acceptance checklist

- [x] The editor has separate Basic, Protocol, Stream, Security, Sniffing and Advanced navigation where the selected protocol supports those settings.
- [x] Advanced editor exposes full-object JSON and focused `settings`, `streamSettings` and `sniffing` sections when applicable.
- [x] Protocol-specific forms, transport forms, TLS and REALITY forms have dedicated source modules rather than decorative placeholder buttons.
- [ ] Add a regression test for settings-tab navigation and advanced JSON section availability.
- [ ] Verify full-object and focused JSON edits round-trip into the saved request; malformed JSON must not silently overwrite valid form state.
- [ ] Exercise representative protocols (VLESS/REALITY, Trojan/WS/TLS, Shadowsocks, WireGuard, Hysteria and MASQUE) through form → wire payload → restored form.
- [ ] Compare the capability list against the upstream `MHSanaei/3x-ui` version targeted by this branch, recording version-specific differences rather than blindly copying settings from another Xray version.
- [ ] Confirm all applicable CI jobs pass, then test on a disposable server with the project's supported Xray version before calling the feature end-to-end verified.

## Safety notes

Some settings are intentionally conditional on protocol or transport. Hiding a setting that does not apply to the selected protocol is not a missing feature. Conversely, a control is only considered implemented when it validates, serializes to the expected backend shape, persists, and is restored on edit.
