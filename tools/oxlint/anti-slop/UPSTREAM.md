# Upstream

- Source: https://github.com/dmmulroy/anti-slop (skill `install-anti-slop`, copied with its
  `scripts/install.mjs`)
- Snapshot: skill folder hash `97962dc9fad565ca7695bf57805d9d0138ce1def`, installed locally on
  2026-10-23; the exact upstream commit is unknown.
- Installed paths: `tools/oxlint/anti-slop/` (generic plugin; `effect/` copied but not registered)
- Dependencies: `oxlint` and `@oxlint/plugins` pinned at `1.91.0`
- Deviations: `no-runtime-typeof` runs with `allowInTypeGuards: true` (see docs/ARCHITECTURE.md)
