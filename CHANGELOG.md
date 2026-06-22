# Changelog

## 0.1.0 — 2026-06-22

- **Initial release.** ~125 GitFlic REST endpoints wrapped under 20 top-level modules.
- Zero external dependencies (pure Node ESM ≥ 18, uses global `fetch`).
- Modules: `mr`, `branch`, `tag`, `release`, `issue`, `commit`, `blob`, `settings`, `user`, `project`, `team`, `company`, `environment`, `webhook`, `registry`, `cicd`, `runner`, `admin`, `saml`, `auth`.
- `gitflic mr <id> --format json | jq` style for AI agents.
- `--project owner/alias` flag (or auto-detect from `git remote get-url origin`).
- 57% coverage of the documented public REST surface (see README table).
