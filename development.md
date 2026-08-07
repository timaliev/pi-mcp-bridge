# Development — pi-mcp-bridge

## Setup

```bash
git clone https://github.com/timaliev/pi-mcp-bridge.git
cd pi-mcp-bridge
npm install
```

## Install locally

```bash
pi install /absolute/path/to/pi-mcp-bridge
# or
pi -e ./index.ts   # one-shot test
```

## Linting & formatting

```bash
npx biome check .        # lint
npx biome check --fix .  # auto-fix
npx biome format .       # format
```

## Git workflow

- NEVER work directly on `develop` or `master`
- Create feature branch from `develop`: `git checkout -b feat/my-feature develop`
- Commit using [conventional commits](https://www.conventionalcommits.org/)
- Open PR to `develop`
- Release: merge `develop` → `release` → PR → `master` (GitHub Actions handles tags + CHANGELOG)
