# Inbound settings capability audit

Scope: EL-UI's real inbound editor and management flow. This is a coverage map, not a
claim that every option has passed an end-to-end server test.

## Existing implementation areas

- **Inbound list and row actions:** `frontend/src/pages/inbounds/InboundsPage.tsx`
  and `frontend/src/pages/inbounds/list/`. Includes details, clone, import/export and
  management actions. Related tests: `clone-inbound-modal.test.tsx`,
  `inbound-clone.test.ts`.
- **General and protocol settings:** `frontend/src/pages/inbounds/form/InboundFormModal.tsx`
  and `frontend/src/pages/inbounds/form/protocols/`. Related tests:
  `inbound-form-modal.test.tsx`, `inbound-defaults.test.ts`.
- **Transport/network settings:** `frontend/src/pages/inbounds/form/transport/`.
  Related test: `inbound-form-blocks.test.tsx`, plus full inbound fixtures.
- **TLS certificates and TLS options:** `frontend/src/pages/inbounds/form/security/tls.tsx`.
  Related test: `inbound-tls-validation.test.ts`.
- **REALITY and target scanner:** `frontend/src/pages/inbounds/form/security/reality.tsx`
  and `RealityTargetScannerModal.tsx`. Related test:
  `reality-mldsa-cert-chain.test.tsx`.
- **Sniffing:** `frontend/src/pages/inbounds/form/SniffingTab.tsx`.
  Related test: `sniffing-field-resync.test.tsx`.
- **Fallback rows:** `FallbacksCard.tsx` and `useInboundFallbacks.ts`.
  Add or extend focused tests during this audit.
- **Full and focused JSON editors:** `advanced-editors.tsx`.
  Add explicit JSON round-trip and invalid-JSON regression coverage during this audit.
- **Form serialization and DB restoration:** `inbound-form-adapter.ts` and
  `inbound-from-db.ts`. Related tests: `inbound-form-adapter.test.ts`,
  `inbound-from-db.test.ts` and `inbound-full.test.ts`.

## Acceptance checklist

- [x] The editor exposes Basics, Protocol, Stream, Security, Sniffing and Advanced tabs
  where the selected protocol supports those settings.
- [x] Advanced editor provides full-object JSON and focused `settings`,
  `streamSettings` and `sniffing` sections when applicable.
- [x] Protocol, transport, TLS and REALITY settings use real form modules rather than
  decorative placeholder buttons.
- [x] Regression coverage checks settings-tab navigation and advanced JSON sections.
- [ ] Verify full-object and focused JSON edits round-trip into the save request.
- [ ] Verify malformed JSON cannot silently overwrite valid form state.
- [ ] Exercise VLESS/REALITY, Trojan/WS/TLS, Shadowsocks, WireGuard, Hysteria and MASQUE
  through form, wire payload and restored form.
- [ ] Compare against the exact upstream `MHSanaei/3x-ui` version targeted by this
  branch. Record version-specific differences instead of copying options from an
  incompatible Xray version.
- [ ] Confirm CI passes, then test on a disposable server with the supported Xray version.

## Safety notes

Some settings are conditional on protocol or transport. Hiding an inapplicable option is
not a missing feature. A control is only considered implemented when it validates,
serializes to the expected backend shape, persists, and is restored when editing.
