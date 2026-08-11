/**
 * Release monitor — checks GitHub for new releases on session start.
 *
 * Gated by 6-hour cooldown. Unauthenticated GitHub API call.
 * Network failure → silent skip. Only notifies when a newer version is found.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLatestRelease } from "./utils.ts";

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const REPO = "timaliev/pi-mcp-bridge";

let lastCheck = 0;

export async function checkForNewRelease(
  sendUserMessage: (msg: string, opts: Record<string, unknown>) => void,
): Promise<void> {
  const now = Date.now();
  if (now - lastCheck < COOLDOWN_MS) return;
  lastCheck = now;

  const localVersion = readLocalVersion();

  try {
    const latest = await fetchLatestRelease(REPO);
    if (!latest || !latest.version || !localVersion) return;

    if (compareVersions(latest.version, localVersion) > 0) {
      sendUserMessage(
        [
          `## pi-mcp-bridge Update Available`,
          ``,
          `**v${latest.version}** is available (you have v${localVersion}).`,
          ``,
          `To upgrade:`,
          `\`\`\``,
          `pi install git:github.com/${REPO}`,
          `\`\`\``,
          ``,
          `Then restart pi or run \`/reload\`.`,
          ``,
          `[View release notes](https://github.com/${REPO}/releases/tag/v${latest.version})`,
        ].join("\n"),
        { deliverAs: "steer" },
      );
    }
  } catch {
    // Silent skip on network failure — no user-facing error
  }
}

function readLocalVersion(): string | undefined {
  try {
    const pkgPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "package.json",
    );
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version;
  } catch {
    return undefined;
  }
}

export function compareVersions(a: string, b: string): number {
  const clean = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [aMaj, aMin, aPat] = clean(a);
  const [bMaj, bMin, bPat] = clean(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPat - bPat;
}
