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
- `utils.ts` — pure utility functions: `expandEnvVars`, `parseSemver`, `isNewer`
- `release-monitor.ts` — checks GitHub for new bridge releases on session start (6h cooldown)
- On `session_start`: reads config, connects to each server, runs per-server version check + setup, registers tools
- On `session_shutdown`: closes all transports
- Per-server version check: compares installed version (via `versionCommand`) with latest GitHub release, skips `setupCommands` if up-to-date
- Environment variable expansion: `$VAR` / `${VAR}` in `env` values

## Conventions

- **Language:** TypeScript (ESM)
- **Package manager:** npm
- **Runtime:** pi extension system (jiti)
- **Testing:** Node.js native test runner (`node --experimental-strip-types --test`)
- **CI/CD:** GitHub Actions (to be added)
- **Versioning:** semantic via git-cliff
