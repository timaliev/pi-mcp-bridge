import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pi-mcp-bridge-test-"));
}

describe("loadMcpJsonConfig", () => {
  it("parses stdio servers from mcp.json format (mcpServers map)", async () => {
    const dir = tmpdir();
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            playwright: {
              command: "npx",
              args: ["@playwright/mcp@latest", "--headless"],
            },
            github: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: { GITHUB_PERSONAL_ACCESS_TOKEN: "$GH_TOKEN" },
            },
          },
        }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);

      assert.equal(servers.length, 2);

      const pw = servers.find((s) => s.name === "playwright");
      assert.ok(pw);
      assert.equal(pw.command, "npx");
      assert.deepEqual(pw.args, ["@playwright/mcp@latest", "--headless"]);

      const gh = servers.find((s) => s.name === "github");
      assert.ok(gh);
      assert.equal(gh.command, "npx");
      assert.deepEqual(gh.args, ["-y", "@modelcontextprotocol/server-github"]);
      assert.deepEqual(gh.env, { GITHUB_PERSONAL_ACCESS_TOKEN: "$GH_TOKEN" });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses HTTP/SSE servers from mcp.json format", async () => {
    const dir = tmpdir();
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            "remote-api": {
              url: "http://localhost:3001/sse",
              headers: { Authorization: "Bearer test" },
            },
          },
        }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);

      assert.equal(servers.length, 1);
      assert.equal(servers[0].name, "remote-api");
      assert.equal(servers[0].url, "http://localhost:3001/sse");
      assert.deepEqual(servers[0].headers, { Authorization: "Bearer test" });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty array when mcp.json does not exist", async () => {
    const dir = tmpdir();
    try {
      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);
      assert.deepEqual(servers, []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty array when mcp.json has no mcpServers key", async () => {
    const dir = tmpdir();
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({ otherKey: true }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);
      assert.deepEqual(servers, []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads from both global ~/.pi/agent/mcp.json and project .mcp.json", async () => {
    const dir = tmpdir();
    const savedAgentDir = process.env.PI_CODING_AGENT_DIR;
    try {
      // Point global agent dir to our test tmpdir/.pi/agent
      const agentDir = path.join(dir, ".pi", "agent");
      process.env.PI_CODING_AGENT_DIR = agentDir;
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            global: { command: "global-cmd", args: [] },
          },
        }),
      );

      // Project .mcp.json with another server
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            project: { command: "project-cmd", args: [] },
          },
        }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);

      assert.equal(servers.length, 2);
      const names = servers.map((s) => s.name).sort();
      assert.deepEqual(names, ["global", "project"]);
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
