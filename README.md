# EL-UI — Eleven Panel

<p align="center">
  <strong>A Persian-first, RTL-friendly control panel built on the 3X-UI codebase.</strong>
  <br />
  <em>Developed and maintained by ArmanEleven</em>
</p>

<p align="center">
  <a href="https://github.com/ArmanEleven/EL-UI">Repository</a>
  ·
  <a href="https://github.com/ArmanEleven/EL-UI/issues">Issues</a>
  ·
  <a href="https://github.com/ArmanEleven/EL-UI/pulls">Pull requests</a>
</p>

---

**EL-UI (Eleven Panel)** is an independent customization of the 3X-UI project, focused on a Persian-first experience, right-to-left (RTL) usability, Eleven branding, and additional multi-admin workflows.

> [!WARNING]
> **Development build — not a stable release.** This repository and the `upload-v4.0.0` branch are under development. Review the code and validate installation, upgrades, access controls, and backups before using it on a production server. Do not assume the upstream 3X-UI installer or updater is compatible with EL-UI.

## Project goals

- **Eleven identity:** a distinct name and visual theme for the panel.
- **Persian and RTL usability:** a Persian-first interface with right-to-left layout support.
- **Multi-admin workflows:** additional secondary-admin management and scoped access, as implemented in this development branch.
- **Responsible iteration:** keep changes reviewable and document compatibility or deployment limitations.

## Features

The current codebase includes features from the 3X-UI foundation alongside EL-UI customizations. Availability and behavior can change while development continues.

- Secondary-admin workflows, including client/traffic quotas and inbound allowlists.
- A separate secondary-admin portal with restricted access to master-panel settings.
- Xray configuration and client management through the panel.
- Multiple inbound protocols, transports, routing options, and subscription formats inherited from the underlying codebase.
- Dark/light themes and multilingual UI support.
- SQLite by default, with PostgreSQL support in the underlying project.

See the source and documentation for the exact implementation status. Do not treat this list as a guarantee that every feature has been fully tested in this development build.

## Repository status

- **Project:** EL-UI / Eleven Panel
- **Maintainer:** [ArmanEleven](https://github.com/ArmanEleven)
- **Current development branch:** `upload-v4.0.0`
- **Default branch:** `main`
- **Release status:** development; no stable EL-UI release is declared here

## Build from source

### Requirements

- A Go version compatible with the version declared in `go.mod`
- Node.js and npm versions compatible with the frontend configuration

### Build

Clone the development branch:

```bash
git clone --branch upload-v4.0.0 https://github.com/ArmanEleven/EL-UI.git
cd EL-UI
```

Build the frontend:

```bash
cd frontend
npm ci
npm run build
cd ..
```

Build the Go application:

```bash
go build -o x-ui .
```

These commands build the application; they do **not** configure a production service, firewall, TLS, database, or secure credentials. Review the project files and deployment documentation before installing anything on a server.

## Security

- Never commit real `.env` files, access tokens, passwords, private keys, database files, or production configuration.
- Use `.env.example` only as a template; fill in secrets locally.
- Report security issues privately to the repository maintainer rather than publishing exploit details in an issue.
- Back up configuration and data before testing upgrades or migrations.

## Documentation

- [Project documentation](docs/)
- [Architecture notes](docs/ELUI-ARCHITECTURE.md)
- [Feature matrix](docs/FEATURE_MATRIX.md)
- [Source audit](docs/SOURCE_AUDIT.md)
- [Decision log](docs/DECISION_LOG.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

Some documents may still describe upstream 3X-UI behavior or earlier development decisions. Check their context and date before relying on them.

## Contributing

Issues, bug reports, and focused pull requests are welcome. Please include reproduction steps, relevant logs with secrets removed, and the branch/commit you tested. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

## Credits and licensing

EL-UI builds on the open-source [3X-UI project](https://github.com/MHSanaei/3x-ui) and retains upstream components and dependencies. We acknowledge the work of the original maintainers and contributors. See [LICENSE](LICENSE) and the relevant source files for licensing terms and notices.

**EL-UI / Eleven Panel** is maintained by [ArmanEleven](https://github.com/ArmanEleven).
