# CONTEXT.md — Glossary for pi-mcp-bridge

## Domain

- **MCP (Model Context Protocol)** — JSON-RPC protocol connecting AI agents to external servers over stdio/SSE
- **pi** — coding agent ([pi.dev](https://pi.dev)) that hosts this extension
- **Extension** — TypeScript module loaded by pi, subscribes to lifecycle events
- **Transport** — stdio (local process) or SSE/HTTP (remote server) MCP connection
- **Server config** — entry in `settings.json > mcpBridge.servers` defining command/args/env for an MCP server

## Architecture

- `index.ts` — pi extension: lifecycle hooks, MCP connect/disconnect, tool registration, JSON Schema → TypeBox
- `schema.ts` — JSON Schema → TypeBox converter (pure, tested)
- `config.ts` — config loading from mcp.json / .mcp.json / settings.json
- `utils.ts` — utility functions: `expandEnvVars`, `parseSemver`, `isNewer`, `fetchLatestRelease`, `checkCooldown`, `formatIssueSummary`
- `release-monitor.ts` — checks GitHub for new bridge releases on session start (6h cooldown)
- On `session_start`: logs startup message (version + docs link), reads config, skips disabled servers, runs setup commands, runs pre-exec commands, connects, registers tools
- On `session_shutdown`: closes all transports
- Per-server features:
  - `disabled: true` — skip server without removing config
  - `preExecCommands` — run shell commands after setup, before connecting
  - `stopOnError: true` — skip server if any setup or pre-exec command fails (default: false)
  - `setupCommands` — install/update commands, run only when version outdated
  - `githubRepo` / `versionCommand` — per-server version check with 1h cooldown
  - `GITHUB_PERSONAL_ACCESS_TOKEN` — if set, used for all GitHub API calls (5000 req/h vs 60)

## Conventions

- **Language:** TypeScript (ESM)
- **Package manager:** npm
- **Runtime:** pi extension system (jiti)
- **Testing:** Node.js native test runner (`node --experimental-strip-types --test`)
- **CI/CD:** GitHub Actions (to be added)
- **Versioning:** semantic via git-cliff
