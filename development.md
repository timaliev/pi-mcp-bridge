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
- Release process (on user request to release):
**IMPORTANT** KEEP THE ORDER OF THE FOLLOWING ITEMS
  - find next project version with `git-cliff --bumped-version` and remember RELEASE_VERSION_TAG (git-cliff output in 'v*.*.*' format) and actual semantic RELEASE_VERSION ('*.*.*' without 'v' in front).
  - update all documentation according to latest changes (if required) in separate branch `doc/release-$RELEASE_VERSION_TAG`, commit and merge to `develop`.
  - change version in `package.json` and `VERSION` files to $RELEASE_VERSION
  - generate `CHANGELOG.md` with `git-cliff`
  - create `release` branch from`develop`
  - commit everything to `release` branch
  - merge `release` → PR → `master`
  - **BEFOR TAGGING MASTER** generate rel-notes with `git-cliff --unreleased --strip all --config github` command
  - tag `master` branch with $RELEASE_VERSION_TAG
  - create GitHub Release with this tag and rel-notes
  - merge `master` back to `develop`
