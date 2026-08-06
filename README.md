# pi-mcp-bridge

MCP (Model Context Protocol) bridge extension for [pi](https://github.com/earendil-works/pi-coding-agent). Connects MCP servers and registers their tools as pi custom tools.

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

Add MCP servers in `~/.pi/agent/settings.json` under `mcpBridge.servers`:

### Stdio servers

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

```json
{
  "mcpBridge": {
    "servers": [
      {
        "name": "remote-server",
        "url": "http://localhost:3001/sse"
      }
    ]
  }
}
```

### Environment variables

Use `$VAR` or `${VAR}` syntax in `env` values — they are expanded at startup:

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

## License

MIT
