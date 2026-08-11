# pi-mcp-bridge

MCP (Model Context Protocol) bridge extension for [pi](https://pi.dev). Connects MCP servers and registers their tools as pi custom tools.

## Installation

```bash
pi install git:github.com/timaliev/pi-mcp-bridge
```

Or via pi packages in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "git:github.com/timaliev/pi-mcp-bridge"
  ]
}
```

## Configuration

MCP servers can be configured in two ways — both are merged at startup
(settings.json wins for same-named servers):

### 1. Standard `mcp.json` (recommended for portability)

Uses the standard MCP config format, compatible with Claude Desktop, VS Code, etc.

**Global** (`~/.pi/agent/mcp.json`):
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_PERSONAL_ACCESS_TOKEN"
      }
    }
  }
}
```

**Project-local** (`.mcp.json` in project root):
```json
{
  "mcpServers": {
    "project-tool": {
      "command": "uv",
      "args": ["run", "my-mcp-server"],
      "cwd": "."
    }
  }
}
```

**With auto-update** (supports `setupCommands`, `githubRepo`, `versionCommand`):
```json
{
  "mcpServers": {
    "ocr": {
      "command": "mcp-ocr",
      "args": [],
      "setupCommands": ["uv tool install --python 3.11 git+https://github.com/timaliev/mcp_ocr.git"],
      "githubRepo": "timaliev/mcp_ocr",
      "versionCommand": "mcp-ocr --version"
    }
  }
}
```

**Pre/post exec commands** — run shell commands before setup and after tool registration:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp"],
      "preExecCommands": ["echo 'starting server setup...'"],
      "postExecCommands": ["echo 'server ready' "]
    }
  }
}
```

**Disabling servers** — skip a server without removing its config:
```json
{
  "mcpServers": {
    "old-tool": {
      "command": "npx",
      "args": ["-y", "old-mcp"],
      "disabled": true
    }
  }
}
```

**stopOnError** — skip server if any pre-exec or setup command fails (default: false):
```json
{
  "mcpServers": {
    "freecad": {
      "command": "freecad-mcp",
      "stopOnError": true,
      "preExecCommands": ["freecadcmd .../blocking_bridge.py &", "sleep 5"]
    }
  }
}
```

### 2. Pi settings.json (alternative, array format)

```json
{
  "mcpBridge": {
    "servers": [
      {
        "name": "my-server",
        "command": "npx",
        "args": ["-y", "@scope/my-mcp-server"]
      },
      {
        "name": "local-python",
        "command": "uv",
        "args": ["run", "my-mcp-server"],
        "cwd": "/path/to/project"
      }
    ]
  }
}
```

### HTTP/SSE servers

MCP has two transport modes:

**stdio** (default) — the bridge spawns the server as a local child process.
Best for tools that run on the same machine as pi.

```
[pi agent] ──stdin/stdout──▶ [mcp-ocr]
   laptop                      laptop
```

**SSE over HTTP** — the bridge connects to an already-running MCP server via URL.
Use when the server runs remotely or you want to share it across clients.

**Example: remote search pipeline**

SearXNG runs on a dedicated search box, `mcp-searxng` runs on an API server
bridging the gap, and pi on your laptop talks to it over the network:

```
[pi agent] ──HTTP/SSE──▶ [mcp-searxng] ──HTTP──▶ [SearXNG]
   laptop                  api-server             search-box
```

Config for this setup:
```json
{
  "mcpServers": {
    "searxng": {
      "url": "http://api-server:3001/sse"
    }
  }
}
```

The `mcp-searxng` server itself is configured with `SEARXNG_URL=http://search-box:8080/searxng`.

**Example: shared database tool**

Team shares one MCP server connected to a Postgres instance:

```
[pi agent A] ──┐
               ├──HTTP/SSE──▶ [mcp-db-server] ──TCP──▶ [Postgres]
[pi agent B] ──┘
```

```json
{
  "mcpServers": {
    "shared-db": {
      "url": "http://db-team.internal:3001/sse"
    }
  }
}
```

### Environment variables

Use `$VAR` or `${VAR}` syntax in `env` values — they are expanded at startup.

**mcp.json:**
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_PERSONAL_ACCESS_TOKEN"
      }
    }
  }
}
```

**settings.json:**
```json
{
  "mcpBridge": {
    "servers": [
      {
        "name": "github",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_PERSONAL_ACCESS_TOKEN"
        }
      }
    ]
  }
}
```

## Companion MCP servers

| Server | Description |
|--------|-------------|
| [mcp_ocr](https://github.com/timaliev/mcp_ocr) | OCR with Vision, PaddleOCR, PaddleOCR-VL backends |
| [mcp_images](https://github.com/timaliev/mcp_images) | Raster image manipulation — Pillow + OpenCV |
| [mcp_pdf2md](https://github.com/timaliev/mcp_pdf2md) | PDF → Markdown conversion via pdf2md |
| [mcp_searxng](https://github.com/timaliev/mcp_searxng) | Web search via SearXNG |

## Updates

The extension checks GitHub for new releases on every session start (6-hour cooldown). If a newer version is available, you'll get a notification with the upgrade command. Network failures are silent — no noise.

If `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable is set, it is used for all GitHub API calls (version checks + self-update), raising the rate limit from 60 to 5000 requests/hour and enabling private repo access.

## License

MIT
