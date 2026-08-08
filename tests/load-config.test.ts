import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pi-mcp-bridge-test-"));
}

describe("loadConfig", () => {
  it("merges mcp.json servers with settings.json servers", async () => {
    const dir = tmpdir();
    const savedAgentDir = process.env.PI_CODING_AGENT_DIR;
    try {
      const agentDir = path.join(dir, ".pi", "agent");
      process.env.PI_CODING_AGENT_DIR = agentDir;
      fs.mkdirSync(agentDir, { recursive: true });

      // Global mcp.json with one server
      fs.writeFileSync(
        path.join(agentDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            mcp_server: { command: "mcp-cmd", args: ["--mcp"] },
          },
        }),
      );

      // Project .mcp.json with another server
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            project_server: { command: "project-cmd", args: ["--project"] },
          },
        }),
      );

      // settings.json with a third server
      fs.writeFileSync(
        path.join(agentDir, "settings.json"),
        JSON.stringify({
          mcpBridge: {
            servers: [
              {
                name: "settings_server",
                command: "settings-cmd",
                args: ["--settings"],
              },
            ],
          },
        }),
      );

      const { loadConfig } = await import("../config.ts");
      const config = loadConfig(dir);

      assert.equal(config.servers.length, 3);
      const names = config.servers.map((s) => s.name).sort();
      assert.deepEqual(names, ["mcp_server", "project_server", "settings_server"]);
    } finally {
      if (savedAgentDir !== undefined) {
        process.env.PI_CODING_AGENT_DIR = savedAgentDir;
      } else {
        delete process.env.PI_CODING_AGENT_DIR;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("settings.json overrides mcp.json for same-named servers", async () => {
    const dir = tmpdir();
    const savedAgentDir = process.env.PI_CODING_AGENT_DIR;
    try {
      const agentDir = path.join(dir, ".pi", "agent");
      process.env.PI_CODING_AGENT_DIR = agentDir;
      fs.mkdirSync(agentDir, { recursive: true });

      // Global mcp.json with server "shared"
      fs.writeFileSync(
        path.join(agentDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            shared: { command: "mcp-version", args: ["--old"] },
          },
        }),
      );

      // settings.json overrides "shared" with different args
      fs.writeFileSync(
        path.join(agentDir, "settings.json"),
        JSON.stringify({
          mcpBridge: {
            servers: [
              {
                name: "shared",
                command: "settings-version",
                args: ["--new"],
                env: { KEY: "val" },
              },
            ],
          },
        }),
      );

      const { loadConfig } = await import("../config.ts");
      const config = loadConfig(dir);

      assert.equal(config.servers.length, 1);
      const shared = config.servers[0];
      assert.equal(shared.name, "shared");
      assert.equal(shared.command, "settings-version");
      assert.deepEqual(shared.args, ["--new"]);
      assert.deepEqual(shared.env, { KEY: "val" });
    } finally {
      if (savedAgentDir !== undefined) {
        process.env.PI_CODING_AGENT_DIR = savedAgentDir;
      } else {
        delete process.env.PI_CODING_AGENT_DIR;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("works when settings.json has no mcpBridge key", async () => {
    const dir = tmpdir();
    const savedAgentDir = process.env.PI_CODING_AGENT_DIR;
    try {
      const agentDir = path.join(dir, ".pi", "agent");
      process.env.PI_CODING_AGENT_DIR = agentDir;
      fs.mkdirSync(agentDir, { recursive: true });

      // settings.json exists but no mcpBridge
      fs.writeFileSync(
        path.join(agentDir, "settings.json"),
        JSON.stringify({ other: true }),
      );

      // mcp.json has one server
      fs.writeFileSync(
        path.join(agentDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            only_mcp: { command: "only-mcp", args: [] },
          },
        }),
      );

      const { loadConfig } = await import("../config.ts");
      const config = loadConfig(dir);

      assert.equal(config.servers.length, 1);
      assert.equal(config.servers[0].name, "only_mcp");
    } finally {
      if (savedAgentDir !== undefined) {
        process.env.PI_CODING_AGENT_DIR = savedAgentDir;
      } else {
        delete process.env.PI_CODING_AGENT_DIR;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("works when no config files exist at all", async () => {
    const dir = tmpdir();
    const savedAgentDir = process.env.PI_CODING_AGENT_DIR;
    try {
      const agentDir = path.join(dir, ".pi", "agent");
      process.env.PI_CODING_AGENT_DIR = agentDir;
      fs.mkdirSync(agentDir, { recursive: true });

      const { loadConfig } = await import("../config.ts");
      const config = loadConfig(dir);

      assert.deepEqual(config.servers, []);
    } finally {
      if (savedAgentDir !== undefined) {
        process.env.PI_CODING_AGENT_DIR = savedAgentDir;
      } else {
        delete process.env.PI_CODING_AGENT_DIR;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
