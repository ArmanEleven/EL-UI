# EL-UI

**An independent management experience planned around the Sanaei 3X-UI foundation.**

EL-UI explores a distinct interface and management layer for existing 3X-UI and Xray workflows. The goal is to go beyond a visual reskin while preserving upstream behavior where compatibility requires it.

> **Status:** Development and source-audit phase. Do not treat this repository as a production installer or assume planned features are already available.

## Goals

- Preserve core inbound, client, subscription, traffic, and Xray management workflows.
- Define a separate management layer for administrator identity and permissions.
- Evaluate role-based access, quotas, bulk operations, backups, and migration tools.
- Redesign the interface without silently changing upstream API behavior.
- Add reproducible tests and safe migration paths before deployment.

These are project goals, not claims that every capability is implemented.

## Development plan

1. Audit source, dependencies, APIs, data models, installation scripts, and license notices.
2. Build a compatibility map for features that can be adapted or need an independent implementation.
3. Establish authentication and server-side authorization boundaries.
4. Validate migration, backup, restore, and rollback procedures.
5. Add regression tests before production deployment.

## Upstream projects

- [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) — planned core foundation; GPL-3.0.
- [HMPanel](https://github.com/neoauroraproject/hmpanel) — reviewed for feature direction. Review its exact license files and dependencies before reusing any code.

Feature inspiration does not imply copied code. Do not copy or redistribute upstream source until the applicable licensing and attribution requirements have been checked.

## Repository notes

Keep credentials, private keys, production databases, and unredacted logs out of version control. Add installation instructions only after the relevant path has been implemented and tested.

## License and attribution

Preserve upstream copyright notices and comply with the applicable GPL-3.0 requirements for any distribution that incorporates the Sanaei 3X-UI codebase. Verify the exact upstream revision and license files before redistribution.
