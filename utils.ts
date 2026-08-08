/**
 * Shared utility functions — pure, zero dependencies, testable standalone.
 */

import { get } from "node:https";

/** Expand ${VAR} and $VAR references using process.env. */
export function expandEnvVars(value: string): string {
  return value.replace(/\$\{?(\w+)\}?/g, (_, name) => process.env[name] ?? "");
}

/** Parse a semver string (with optional "v" prefix) into [major, minor, patch]. */
export function parseSemver(v: string): [number, number, number] | null {
  const m = v.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

/** Returns true if `latest` is semantically newer than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const l = parseSemver(latest);
  const c = parseSemver(current);
  if (!l || !c) return false;
  if (l[0] !== c[0]) return l[0] > c[0];
  if (l[1] !== c[1]) return l[1] > c[1];
  return l[2] > c[2];
}

export interface ReleaseResult {
  version: string | null;
  rateLimited: boolean;
}

/** Fetch latest release tag from GitHub API. Returns version + rate-limit status. */
export function fetchLatestRelease(githubRepo: string): Promise<ReleaseResult> {
  return new Promise((resolve) => {
    const req = get(
      {
        hostname: "api.github.com",
        path: `/repos/${githubRepo}/releases/latest`,
        headers: {
          "User-Agent": "pi-mcp-bridge",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const remaining = parseInt(res.headers["x-ratelimit-remaining"] ?? "1", 10);
            if (res.statusCode !== 200) {
              resolve({ version: null, rateLimited: remaining === 0 });
              return;
            }
            const release = JSON.parse(data) as { tag_name: string };
            resolve({ version: release.tag_name.replace(/^v/, ""), rateLimited: false });
          } catch {
            resolve({ version: null, rateLimited: false });
          }
        });
      },
    );
    req.on("error", () => resolve({ version: null, rateLimited: false }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ version: null, rateLimited: false });
    });
    req.end();
  });
}

/** In-memory cooldown tracker — prevents repeated checks within COOLDOWN_MS. */
const cooldowns = new Map<string, number>();
export const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function checkCooldown(key: string): boolean {
  const last = cooldowns.get(key);
  const now = Date.now();
  if (last && now - last < COOLDOWN_MS) return true;
  cooldowns.set(key, now);
  return false;
}
