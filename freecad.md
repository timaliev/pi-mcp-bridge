# FreeCAD + Pi MCP Bridge Setup

How to connect FreeCAD to Pi via `pi-mcp-bridge` for AI-assisted 3D modeling.

## Architecture

```
Pi ──stdio──▶ freecad-mcp (Python) ──XML-RPC──▶ FreeCAD (headless or GUI)
                                              localhost:9875
```

- **`freecad-mcp`** — Python MCP server (installed via pip/uv, provides 150+ CAD tools)
- **FreeCAD** — runs with the Robust MCP Bridge workbench loaded, exposes XML-RPC on `:9875`
- **`pi-mcp-bridge`** — spawns `freecad-mcp` as a child process and registers its tools in Pi

## Prerequisites

| | macOS | Linux |
|---|---|---|
| **FreeCAD** | 1.0+ ([download](https://www.freecad.org/downloads.php)) | 1.0+ (`apt install freecad` or AppImage) |
| **Python** | 3.11 (bundled with FreeCAD, or via homebrew) | 3.11 (system or pyenv) |
| **freecad-mcp** | `pip install freecad-robust-mcp` | `pip install freecad-robust-mcp` |
| **pi-mcp-bridge** | `pi install git:github.com/timaliev/pi-mcp-bridge` | same |

## Step 1: Install the Robust MCP Bridge workbench

The workbench must be installed into FreeCAD's Mod directory. You can use FreeCAD's Addon Manager GUI or the console.

### Option A: FreeCAD GUI (easy)

1. Open FreeCAD
2. **Tools → Addon Manager**
3. Search for "Robust MCP Bridge"
4. Install and restart FreeCAD

### Option B: Console (macOS)

```bash
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd -c "
import sys
sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/Mod/AddonManager')
from Addon import Addon
from addonmanager_installer import AddonInstaller

addon = Addon(
    name='RobustMCPBridge',
    url='https://github.com/spkane/freecad-addon-robust-mcp-server',
    branch='main'
)
AddonInstaller(addon).run()
"
```

### Option C: Console (Linux)

```bash
freecadcmd -c "
import sys
sys.path.insert(0, '/usr/share/freecad/Mod/AddonManager')
from Addon import Addon
from addonmanager_installer import AddonInstaller

addon = Addon(
    name='RobustMCPBridge',
    url='https://github.com/spkane/freecad-addon-robust-mcp-server',
    branch='main'
)
AddonInstaller(addon).run()
"
```

### Verify installation

```bash
# macOS
find ~/Library/Application\ Support/FreeCAD -name "blocking_bridge.py"

# Linux
find ~/.local/share/FreeCAD -name "blocking_bridge.py"
```

Note the path — you'll need it for the preExecCommands below.

## Step 2: Configure Pi

Add to `~/.pi/agent/mcp.json`:

### Headless mode (no GUI, all modeling operations work)

```json
{
  "mcpServers": {
    "freecad": {
      "command": "freecad-mcp",
      "env": { "FREECAD_MODE": "xmlrpc" },
      "preExecCommands": [
        "/usr/bin/freecadcmd ~/.local/share/FreeCAD/Mod/RobustMCPBridge/freecad/RobustMCPBridge/freecad_mcp_bridge/blocking_bridge.py &",
        "sleep 5"
      ]
    }
  }
}
```

**macOS path** — replace the `freecadcmd` and `blocking_bridge.py` paths:

```json
"preExecCommands": [
  "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd ~/Library/Application\\ Support/FreeCAD/v1-1/Mod/RobustMCPBridge/freecad/RobustMCPBridge/freecad_mcp_bridge/blocking_bridge.py &",
  "sleep 5"
]
```

### GUI mode (full visual feedback, screenshots, colors)

Start FreeCAD GUI manually **before** launching Pi:

```bash
# macOS
open /Applications/FreeCAD.app

# Linux
freecad &
```

Then switch to the **Robust MCP Bridge** workbench and click **Start MCP Bridge**.

Config (no preExecCommands needed — bridge is already running):

```json
{
  "mcpServers": {
    "freecad": {
      "command": "freecad-mcp",
      "env": { "FREECAD_MODE": "xmlrpc" }
    }
  }
}
```

### Disable FreeCAD temporarily

```json
{
  "mcpServers": {
    "freecad": {
      "command": "freecad-mcp",
      "disabled": true
    }
  }
}
```

## Step 3: Verify

Start Pi. You should see:

```
[mcp-bridge] Pre-exec "freecad": /usr/bin/freecadcmd .../blocking_bridge.py &
[mcp-bridge] Pre-exec "freecad": sleep 5
[mcp-bridge] Connected to "freecad" — N tool(s): mcp_freecad_...
```

In Pi, ask: **"Check the FreeCAD connection status"**

## Headless vs GUI

| Feature | Headless | GUI |
|---|---|---|
| Object creation | ✅ | ✅ |
| Boolean operations | ✅ | ✅ |
| Export (STEP, STL) | ✅ | ✅ |
| PartDesign workflow | ✅ | ✅ |
| Screenshots | ❌ | ✅ |
| Object colors/visibility | ❌ | ✅ |
| Camera control | ❌ | ✅ |
| Interactive selection | ❌ | ✅ |
| Auto-starts with Pi | ✅ | ❌ (manual start) |

## Troubleshooting

### "Connection refused" / "Cannot connect to FreeCAD at localhost:9875"

FreeCAD is not running or the bridge workbench isn't active.

- **Headless**: check that `blocking_bridge.py` path in `preExecCommands` matches the `find` output from Step 1
- **GUI**: make sure you clicked **Start MCP Bridge** in the workbench toolbar
- Increase `sleep` to 10 if FreeCAD is slow to start

### "freecadcmd: command not found" (Linux)

```bash
# Find it
which freecadcmd || find / -name "freecadcmd" 2>/dev/null

# Common paths:
# /usr/bin/freecadcmd
# /usr/lib/freecad/bin/freecadcmd
# ~/Applications/FreeCAD.AppImage --appimage-extract-and-run ...
```

### "GitHub rate limited"

Per-server version check hit the 60 req/hour limit. Wait or use GUI mode (no version check needed). The 1-hour cooldown in pi-mcp-bridge v1.3.4+ helps.

### Workbench installed but tools don't appear

Check the Pi startup log for `[mcp-bridge] Connected to "freecad"`. If missing, verify `freecad-mcp` is installed:

```bash
which freecad-mcp || pip install freecad-robust-mcp
```

## Companion docs

- [freecad-robust-mcp-server](https://github.com/spkane/freecad-addon-robust-mcp-server) — upstream project
- [pi-mcp-bridge](https://github.com/timaliev/pi-mcp-bridge) — the bridge that connects MCP servers to Pi
