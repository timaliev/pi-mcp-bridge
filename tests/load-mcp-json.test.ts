import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pi-mcp-bridge-test-"));
}

/** Isolate PI_CODING_AGENT_DIR to tmpdir so real ~/.pi/agent/mcp.json doesn't leak */
function isolateAgentDir(dir: string): string | undefined {
  const saved = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  return saved;
}

function restoreAgentDir(saved: string | undefined) {
  if (saved !== undefined) {
    process.env.PI_CODING_AGENT_DIR = saved;
  } else {
    delete process.env.PI_CODING_AGENT_DIR;
  }
}

describe("loadMcpJsonConfig", () => {
  it("parses stdio servers from mcp.json format (mcpServers map)", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
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
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses HTTP/SSE servers from mcp.json format", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
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
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty array when mcp.json does not exist", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
    try {
      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);
      assert.deepEqual(servers, []);
    } finally {
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty array when mcp.json has no mcpServers key", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({ otherKey: true }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);
      assert.deepEqual(servers, []);
    } finally {
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses setupCommands, githubRepo, versionCommand from mcp.json", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            ocr: {
              command: "mcp-ocr",
              args: [],
              setupCommands: ["npm install -g timaliev/mcp_ocr"],
              githubRepo: "timaliev/mcp_ocr",
              versionCommand: "mcp-ocr --version",
            },
          },
        }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);

      assert.equal(servers.length, 1);
      const s = servers[0];
      assert.equal(s.name, "ocr");
      assert.equal(s.command, "mcp-ocr");
      assert.deepEqual(s.setupCommands, ["npm install -g timaliev/mcp_ocr"]);
      assert.equal(s.githubRepo, "timaliev/mcp_ocr");
      assert.equal(s.versionCommand, "mcp-ocr --version");
    } finally {
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads from both global ~/.pi/agent/mcp.json and project .mcp.json", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(path.join(dir, ".pi", "agent"));
    try {
      const agentDir = path.join(dir, ".pi", "agent");
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
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses disabled flag from mcp.json", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            active: { command: "active-cmd", args: [] },
            off: { command: "off-cmd", args: [], disabled: true },
          },
        }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);

      assert.equal(servers.length, 2);
      const active = servers.find((s) => s.name === "active");
      const off = servers.find((s) => s.name === "off");
      assert.ok(active);
      assert.ok(off);
      assert.equal(active.disabled, undefined);
      assert.equal(off.disabled, true);
    } finally {
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses preExecCommands and postExecCommands from mcp.json", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            tool: {
              command: "tool-cmd",
              args: [],
              preExecCommands: ["echo pre1", "echo pre2"],
              postExecCommands: ["echo post1"],
            },
          },
        }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);

      assert.equal(servers.length, 1);
      const s = servers[0];
      assert.equal(s.name, "tool");
      assert.deepEqual(s.preExecCommands, ["echo pre1", "echo pre2"]);
      assert.deepEqual(s.postExecCommands, ["echo post1"]);
    } finally {
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses stopOnError flag from mcp.json", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            strict: { command: "strict-cmd", args: [], stopOnError: true },
            lax: { command: "lax-cmd", args: [] },
          },
        }),
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);

      assert.equal(servers.length, 2);
      const strict = servers.find((s) => s.name === "strict");
      const lax = servers.find((s) => s.name === "lax");
      assert.ok(strict);
      assert.ok(lax);
      assert.equal(strict.stopOnError, true);
      assert.equal(lax.stopOnError, undefined);
    } finally {
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles invalid JSON gracefully — returns empty array", async () => {
    const dir = tmpdir();
    const saved = isolateAgentDir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, ".mcp.json"),
        "{ invalid json }}}}}}}}}}}",
      );

      const { loadMcpJsonConfig } = await import("../config.ts");
      const servers = loadMcpJsonConfig(dir);
      assert.deepEqual(servers, []);
    } finally {
      restoreAgentDir(saved);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
