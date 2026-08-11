/**
 * MCP Bridge Extension for pi
 *
 * Connects to MCP (Model Context Protocol) servers and registers their tools
 * as pi custom tools. Supports stdio and SSE/HTTP transports.
 *
 * Configuration in ~/.pi/agent/settings.json:
 *
 *   "mcpBridge": {
 *     "servers": [
 *       {
 *         "name": "filesystem",
 *         "command": "npx",
 *         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
 *       },
 *       {
 *         "name": "my-http-server",
 *         "url": "http://localhost:3001/sse"
 *       }
 *     ]
 *   }
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { TSchema } from "typebox";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  type ServerConfig,
  type StdioServerConfig,
  isStdioConfig,
  loadConfig,
} from "./config.js";
import { checkForNewRelease } from "./release-monitor.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectedServer {
  config: ServerConfig;
  client: Client;
  transport: Transport;
  toolNames: string[];
}

import { expandEnvVars } from "./utils.js";

export function expandEnvInObject(obj: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!obj) return obj;
  const expanded: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    expanded[k] = expandEnvVars(v);
  }
  return expanded;
}

// ---------------------------------------------------------------------------
// JSON Schema → TypeBox converter
// ---------------------------------------------------------------------------

function jsonSchemaToTypeBox(schema: Record<string, unknown>, rootDescription?: string): TSchema {
  if (!schema || typeof schema !== "object") return Type.Any();

  const desc = typeof schema.description === "string" ? schema.description : undefined;

  // Handle const
  if ("const" in schema) {
    return Type.Literal(schema.const);
  }

  // Handle enum (no type field, or type: "string" with enum)
  if (Array.isArray(schema.enum)) {
    const literals = schema.enum.map((v) => Type.Literal(v));
    if (literals.length === 1) return literals[0];
    return Type.Union(literals as [TSchema, ...TSchema[]]);
  }

  // Handle $ref (basic, resolve against definitions if present)
  if (typeof schema.$ref === "string") {
    // For now return any — proper $ref resolution needs the full document
    return Type.Any({ description: `$ref: ${schema.$ref}` });
  }

  // Handle oneOf / anyOf
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const options = schema.oneOf.map((s: Record<string, unknown>) =>
      jsonSchemaToTypeBox(s),
    );
    return Type.Union(options as [TSchema, ...TSchema[]], desc ? { description: desc } : undefined);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const options = schema.anyOf.map((s: Record<string, unknown>) =>
      jsonSchemaToTypeBox(s),
    );
    return Type.Union(options as [TSchema, ...TSchema[]], desc ? { description: desc } : undefined);
  }

  const type = schema.type;

  // Handle array
  if (type === "array") {
    const items = schema.items
      ? jsonSchemaToTypeBox(schema.items as Record<string, unknown>)
      : Type.Any();
    const minItems =
      typeof schema.minItems === "number" ? schema.minItems : undefined;
    const maxItems =
      typeof schema.maxItems === "number" ? schema.maxItems : undefined;
    return Type.Array(items, {
      ...(desc ? { description: desc } : {}),
      ...(minItems !== undefined ? { minItems } : {}),
      ...(maxItems !== undefined ? { maxItems } : {}),
    });
  }

  // Handle object
  if (type === "object") {
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = (Array.isArray(schema.required) ? schema.required : []) as string[];

    const typeBoxProps: Record<string, TSchema> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      const converted = jsonSchemaToTypeBox(propSchema);
      typeBoxProps[key] = required.includes(key) ? converted : Type.Optional(converted);
    }

    const additionalProperties = schema.additionalProperties as
      | boolean
      | Record<string, unknown>
      | undefined;
    const options: Record<string, unknown> = {};
    if (desc) options.description = desc;
    if (additionalProperties === false) options.additionalProperties = false;

    return Type.Object(typeBoxProps, options);
  }

  // Handle primitives
  const opts = desc ? { description: desc } : {};

  switch (type) {
    case "string":
      return Type.String(opts);
    case "number":
      return Type.Number(opts);
    case "integer":
      return Type.Number({ ...opts, description: `${desc ?? ""} (integer)`.trim() });
    case "boolean":
      return Type.Boolean(opts);
    case "null":
      return Type.Null(desc ? { description: desc } : undefined);
    default:
      // Try to infer from properties even without explicit type
      if ("properties" in schema || "additionalProperties" in schema) {
        return jsonSchemaToTypeBox({ ...schema, type: "object" });
      }
      if ("items" in schema) {
        return jsonSchemaToTypeBox({ ...schema, type: "array" });
      }
      return Type.Any(desc ? { description: desc } : undefined);
  }
}

// ---------------------------------------------------------------------------
// Version check
// ---------------------------------------------------------------------------

import { parseSemver, isNewer, fetchLatestRelease, checkCooldown } from "./utils.js";

async function getInstalledVersion(command: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("sh", ["-c", command], {
      timeout: 10_000,
      encoding: "utf-8",
    });
    const m = stdout.trim().match(/(\d+\.\d+\.\d+)/);
    return m ? m[1] : stdout.trim() || null;
  } catch {
    return null;
  }
}


// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default async function (pi: ExtensionAPI) {
  const connectedServers: ConnectedServer[] = [];

  // ---- connect to all configured MCP servers ----
  async function connectAll(ctx: { cwd: string }) {
    const config = loadConfig(ctx.cwd);
    if (config.servers.length === 0) return;

    for (const serverConfig of config.servers) {
      try {
        // Skip disabled servers
        if (serverConfig.disabled) {
          console.error(`[mcp-bridge] "${serverConfig.name}" is disabled, skipping`);
          continue;
        }

        let transport: Transport;

        if (isStdioConfig(serverConfig)) {
          let commandFailed = false;

          // Run pre-exec commands
          if (serverConfig.preExecCommands && serverConfig.preExecCommands.length > 0) {
            const preCwd = serverConfig.cwd ?? ctx.cwd;
            for (const cmd of serverConfig.preExecCommands) {
              try {
                console.error(`[mcp-bridge] Pre-exec "${serverConfig.name}": ${cmd}`);
                execSync(cmd, {
                  cwd: preCwd,
                  env: { ...process.env, ...expandEnvInObject(serverConfig.env) },
                  timeout: 120_000,
                  stdio: ["ignore", "pipe", "pipe"],
                });
              } catch (err) {
                commandFailed = true;
                console.error(
                  `[mcp-bridge] Pre-exec command failed for "${serverConfig.name}": ${cmd}`,
                  err instanceof Error ? err.message : err,
                );
              }
            }
          }

          // Stop early if stopOnError and a pre-exec command failed
          if (serverConfig.stopOnError && commandFailed) {
            console.error(`[mcp-bridge] "${serverConfig.name}" — command failed with stopOnError set, skipping`);
            continue;
          }

          // Run setup commands if version is outdated
          const hasSetup = serverConfig.setupCommands && serverConfig.setupCommands.length > 0;
          const hasVersionCheck = hasSetup && serverConfig.githubRepo && serverConfig.versionCommand;
          let needsSetup = hasSetup;

          if (hasVersionCheck) {
            const cacheKey = `vercheck:${serverConfig.githubRepo}`;
            if (checkCooldown(cacheKey)) {
              console.error(`[mcp-bridge] "${serverConfig.name}" — version check skipped (cooldown), skipping setup`);
              needsSetup = false;
            } else {
              const installed = await getInstalledVersion(serverConfig.versionCommand!);
              if (installed) {
                const result = await fetchLatestRelease(serverConfig.githubRepo!);
                if (result.version && !isNewer(result.version, installed)) {
                  console.error(`[mcp-bridge] "${serverConfig.name}" ${installed} is up to date, skipping setup`);
                  needsSetup = false;
                } else if (result.version) {
                  console.error(`[mcp-bridge] "${serverConfig.name}" ${installed} → ${result.version}, running setup`);
                } else if (result.rateLimited) {
                  console.error(`[mcp-bridge] "${serverConfig.name}" ${installed} — GitHub rate limited, skipping setup`);
                  needsSetup = false;
                } else {
                  console.error(`[mcp-bridge] "${serverConfig.name}" ${installed} — can't check for updates (network), skipping setup`);
                  needsSetup = false;
                }
              }
            }
          }

          if (needsSetup && hasSetup) {
            const setupCwd = serverConfig.cwd ?? ctx.cwd;
            for (const cmd of serverConfig.setupCommands!) {
              try {
                console.error(`[mcp-bridge] Setup "${serverConfig.name}": ${cmd}`);
                execSync(cmd, {
                  cwd: setupCwd,
                  env: { ...process.env, ...expandEnvInObject(serverConfig.env) },
                  timeout: 120_000,
                  stdio: ["ignore", "pipe", "pipe"],
                });
              } catch (err) {
                commandFailed = true;
                console.error(
                  `[mcp-bridge] Setup command failed for "${serverConfig.name}": ${cmd}`,
                  err instanceof Error ? err.message : err,
                );
                // Continue anyway — setup is best-effort
              }
            }
          }

          // Stop if stopOnError and any command (pre or setup) failed
          if (serverConfig.stopOnError && commandFailed) {
            console.error(`[mcp-bridge] "${serverConfig.name}" — command failed with stopOnError set, skipping`);
            continue;
          }

          const params: StdioServerParameters = {
            command: serverConfig.command,
            args: serverConfig.args ?? [],
            env: expandEnvInObject(serverConfig.env),
            cwd: serverConfig.cwd ?? ctx.cwd,
          };
          const t = new StdioClientTransport(params);
          // Start the transport manually
          // (StdioClientTransport manages its own stdio lifecycle)
          transport = t;
        } else {
          // SSE/HTTP transport
          transport = new SSEClientTransport(
            new URL(serverConfig.url),
            serverConfig.headers
              ? { requestInit: { headers: serverConfig.headers } }
              : undefined,
          );
        }

        const client = new Client(
          { name: "pi-mcp-bridge", version: "1.0.0" },
          { capabilities: {} },
        );

        await client.connect(transport);
        const { tools } = await client.listTools();

        const toolNames: string[] = [];

        for (const mcpTool of tools) {
          // Sanitize tool name for pi (prepend server name to avoid collisions)
          const piToolName = `mcp_${serverConfig.name}_${mcpTool.name}`
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .toLowerCase();

          try {
            const paramsSchema =
              ("inputSchema" in mcpTool && mcpTool.inputSchema
                ? jsonSchemaToTypeBox(mcpTool.inputSchema as Record<string, unknown>, mcpTool.description)
                : Type.Object({}));

            pi.registerTool({
              name: piToolName,
              label: `${serverConfig.name}:${mcpTool.name}`,
              description: `[MCP] ${mcpTool.description ?? mcpTool.name}`,
              parameters: paramsSchema,
              async execute(_toolCallId, params) {
                const result = await client.callTool({
                  name: mcpTool.name,
                  arguments: params as Record<string, unknown>,
                });

                // Normalize MCP content to pi tool result
                const textParts: string[] = [];
                const detailsParts: Record<string, unknown> = {};

                for (const item of result.content as Array<{ type: string; text?: string; mimeType?: string; resource?: { uri?: string; text?: string } }>) {
                  if (item.type === "text") {
                    textParts.push(item.text);
                  } else if (item.type === "image") {
                    textParts.push(`[Image: ${item.mimeType}, data omitted]`);
                  } else if (item.type === "resource") {
                    textParts.push(
                      `[Resource: ${item.resource?.uri ?? "unknown"} — ${item.resource?.text?.slice(0, 500) ?? "binary"}]`,
                    );
                  } else {
                    textParts.push(JSON.stringify(item));
                  }
                }

                detailsParts.isError = result.isError ?? false;
                detailsParts.mcpToolName = mcpTool.name;
                detailsParts.mcpServerName = serverConfig.name;

                return {
                  content: [
                    {
                      type: "text",
                      text: textParts.join("\n") || "(no output)",
                    },
                  ],
                  details: detailsParts,
                  isError: result.isError ?? false,
                };
              },
            });

            toolNames.push(piToolName);
          } catch (err) {
            console.error(
              `[mcp-bridge] Failed to register tool "${mcpTool.name}" from server "${serverConfig.name}":`,
              err instanceof Error ? err.message : err,
            );
          }
        }

        connectedServers.push({
          config: serverConfig,
          client,
          transport,
          toolNames,
        });

        // Run post-exec commands after successful tool registration
        if (isStdioConfig(serverConfig) && serverConfig.postExecCommands && serverConfig.postExecCommands.length > 0) {
          const postCwd = serverConfig.cwd ?? ctx.cwd;
          for (const cmd of serverConfig.postExecCommands) {
            try {
              console.error(`[mcp-bridge] Post-exec "${serverConfig.name}": ${cmd}`);
              execSync(cmd, {
                cwd: postCwd,
                env: { ...process.env, ...expandEnvInObject(serverConfig.env) },
                timeout: 120_000,
                stdio: ["ignore", "pipe", "pipe"],
              });
            } catch (err) {
              console.error(
                `[mcp-bridge] Post-exec command failed for "${serverConfig.name}": ${cmd}`,
                err instanceof Error ? err.message : err,
              );
            }
          }
        }

        console.error(
          `[mcp-bridge] Connected to "${serverConfig.name}" — ${toolNames.length} tool(s): ${toolNames.join(", ")}`,
        );
      } catch (err) {
        console.error(
          `[mcp-bridge] Failed to connect to server "${serverConfig.name}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  // ---- disconnect all servers ----
  async function disconnectAll() {
    const errors: Array<{ name: string; error: string }> = [];
    for (const { config, transport, client } of connectedServers) {
      try {
        await transport.close();
      } catch (err) {
        errors.push({
          name: config.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    connectedServers.length = 0;

    if (errors.length > 0) {
      for (const { name, error } of errors) {
        console.error(`[mcp-bridge] Error closing "${name}": ${error}`);
      }
    }
  }

  // ---- lifecycle: connect on session_start, disconnect on session_shutdown ----
  pi.on("session_start", async (_event, ctx) => {
    // Startup message with version and docs link
    try {
      const pkg = JSON.parse(readFileSync(
        new URL("./package.json", import.meta.url), "utf-8"
      ));
      console.error(`[mcp-bridge] pi-mcp-bridge v${pkg.version} — https://github.com/timaliev/pi-mcp-bridge`);
    } catch { /* ignore */ }
    await connectAll(ctx);
    checkForNewRelease(pi.sendUserMessage.bind(pi));
  });

  pi.on("session_shutdown", async () => {
    await disconnectAll();
  });

  // ---- command: list MCP servers ----
  pi.registerCommand("mcp-list", {
    description: "List connected MCP servers and their tools",
    handler: async (_args, ctx) => {
      if (connectedServers.length === 0) {
        ctx.ui.notify("No MCP servers connected.", "info");
        return;
      }

      const lines: string[] = [];
      for (const server of connectedServers) {
        lines.push(`**${server.config.name}** (${server.toolNames.length} tools)`);
        for (const name of server.toolNames) {
          lines.push(`  - \`${name}\``);
        }
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
