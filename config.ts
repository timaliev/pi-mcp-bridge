/**
 * MCP Bridge config loading — supports both standard mcp.json and pi settings.json.
 *
 * Zero external dependencies. Testable standalone.
 */
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StdioServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  setupCommands?: string[];
  githubRepo?: string;
  versionCommand?: string;
}

export interface HttpServerConfig {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

export type ServerConfig = StdioServerConfig | HttpServerConfig;

export interface McpBridgeConfig {
  servers: ServerConfig[];
}

export function isStdioConfig(c: ServerConfig): c is StdioServerConfig {
  return "command" in c;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/**
 * Load MCP servers from standard mcp.json / .mcp.json files.
 *
 * Looks for:
 *   1. ~/.pi/agent/mcp.json (global, respects PI_CODING_AGENT_DIR)
 *   2. .mcp.json (project-local, in cwd)
 *
 * Standard format:
 *   { "mcpServers": { "name": { "command": "...", "args": [...] } } }
 */
export function loadMcpJsonConfig(cwd: string): ServerConfig[] {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR ??
    path.join(process.env.HOME ?? "~", ".pi", "agent");

  const sources = [
    path.join(agentDir, "mcp.json"), // global
    path.join(cwd, ".mcp.json"), // project
  ];

  const servers: ServerConfig[] = [];

  for (const sourcePath of sources) {
    try {
      if (!fs.existsSync(sourcePath)) continue;
      const raw = fs.readFileSync(sourcePath, "utf-8");
      const config = JSON.parse(raw);
      const mcpServers = config?.mcpServers;
      if (!mcpServers || typeof mcpServers !== "object") continue;

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        if (!serverConfig || typeof serverConfig !== "object") continue;
        const sc = serverConfig as Record<string, unknown>;

        if (typeof sc.url === "string") {
          servers.push({
            name,
            url: sc.url as string,
            headers: sc.headers as Record<string, string> | undefined,
          });
        } else if (typeof sc.command === "string") {
          servers.push({
            name,
            command: sc.command as string,
            args: Array.isArray(sc.args) ? (sc.args as string[]) : undefined,
            env: sc.env as Record<string, string> | undefined,
            cwd: typeof sc.cwd === "string" ? (sc.cwd as string) : undefined,
            setupCommands:
              Array.isArray(sc.setupCommands)
                ? (sc.setupCommands as string[])
                : undefined,
            githubRepo:
              typeof sc.githubRepo === "string"
                ? (sc.githubRepo as string)
                : undefined,
            versionCommand:
              typeof sc.versionCommand === "string"
                ? (sc.versionCommand as string)
                : undefined,
          });
        }
      }
    } catch (err) {
      console.error(
        `[mcp-bridge] Failed to load ${sourcePath}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return servers;
}

/**
 * Load merged MCP server config from all sources.
 * Priority: settings.json → mcp.json → .mcp.json (first wins for same name).
 */
export function loadConfig(cwd: string): McpBridgeConfig {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR ??
    path.join(process.env.HOME ?? "~", ".pi", "agent");

  // 1. Load from standard mcp.json files
  const mcpJsonServers = loadMcpJsonConfig(cwd);

  // 2. Load from pi settings.json (mcpBridge.servers array)
  const settingsPath = path.join(agentDir, "settings.json");
  let settingsServers: ServerConfig[] = [];
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      const settings = JSON.parse(raw);
      const bridge = settings?.mcpBridge;
      if (bridge?.servers && Array.isArray(bridge.servers)) {
        settingsServers = bridge.servers;
      }
    }
  } catch {
    // settings.json errors are non-fatal
  }

  // 3. Merge: settings.json wins over mcp.json for same-named servers
  const merged = new Map<string, ServerConfig>();
  for (const s of mcpJsonServers) merged.set(s.name, s);
  for (const s of settingsServers) merged.set(s.name, s);

  return { servers: [...merged.values()] };
}
