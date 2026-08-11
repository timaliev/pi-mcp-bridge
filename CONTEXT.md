# CONTEXT.md — Glossary for pi-mcp-bridge

## Domain

- **MCP (Model Context Protocol)** — JSON-RPC protocol connecting AI agents to external servers over stdio/SSE
- **pi** — coding agent ([pi.dev](https://pi.dev)) that hosts this extension
- **Extension** — TypeScript module loaded by pi, subscribes to lifecycle events
- **Transport** — stdio (local process) or SSE/HTTP (remote server) MCP connection
- **Server config** — entry in `settings.json > mcpBridge.servers` defining command/args/env for an MCP server

## Architecture

- `index.ts` — pi extension: lifecycle hooks, MCP connect/disconnect, tool registration, JSON Schema → TypeBox
- `config.ts` — config loading from mcp.json / .mcp.json / settings.json
- `utils.ts` — pure utility functions: `expandEnvVars`, `parseSemver`, `isNewer`, `fetchLatestRelease`, `checkCooldown`
- `release-monitor.ts` — checks GitHub for new bridge releases on session start (6h cooldown)
- On `session_start`: logs startup message (version + docs link), reads config, skips disabled servers, runs pre-exec commands, version check + setup, connects, registers tools, runs post-exec commands
- On `session_shutdown`: closes all transports
- Per-server features:
  - `disabled: true` — skip server without removing config
  - `preExecCommands` / `postExecCommands` — run shell commands before/after server lifecycle
  - Version check — compares installed version with latest GitHub release, skips `setupCommands` if up-to-date (1h cooldown)
- Environment variable expansion: `$VAR` / `${VAR}` in `env` values

## Conventions

- **Language:** TypeScript (ESM)
- **Package manager:** npm
- **Runtime:** pi extension system (jiti)
- **Testing:** Node.js native test runner (`node --experimental-strip-types --test`)
- **CI/CD:** GitHub Actions (to be added)
- **Versioning:** semantic via git-cliff
