# CONTEXT.md — Glossary for pi-mcp-bridge

## Domain

- **MCP (Model Context Protocol)** — JSON-RPC protocol connecting AI agents to external servers over stdio/SSE
- **pi** — coding agent ([pi.dev](https://pi.dev)) that hosts this extension
- **Extension** — TypeScript module loaded by pi, subscribes to lifecycle events
- **Transport** — stdio (local process) or SSE/HTTP (remote server) MCP connection
- **Server config** — entry in `settings.json > mcpBridge.servers` defining command/args/env for an MCP server

## Architecture

- `index.ts` — single-file pi extension
- On `session_start`: reads `mcpBridge` config, connects to each server, registers their tools
- On `session_shutdown`: closes all transports
- JSON Schema → TypeBox converter for tool parameter schemas
- Environment variable expansion: `$VAR` / `${VAR}` in `env` values

## Conventions

- **Language:** TypeScript (ESM)
- **Package manager:** npm
- **Runtime:** pi extension system (jiti)
- **Testing:** (to be added)
- **CI/CD:** GitHub Actions (to be added)
- **Versioning:** semantic via git-cliff
