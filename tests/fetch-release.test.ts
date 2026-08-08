/**
 * Integration test: actual GitHub API call for fetchLatestRelease.
 * Verifies User-Agent header is sent and response is parsed correctly.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("fetchLatestRelease (HTTP integration)", () => {
  it("fetches latest release from GitHub API with User-Agent", async () => {
    const { fetchLatestRelease } = await import("../utils.ts");
    const result = await fetchLatestRelease("timaliev/pi-mcp-bridge");
    
    if (result.rateLimited) {
      // Rate limited — skip assertion but don't fail (external dependency)
      console.log("  (rate limited — skipping assertion)");
      return;
    }
    assert.ok(result.version, "should return a version, not null (network/rate-limit)");
    assert.match(result.version, /^\d+\.\d+\.\d+/, "version should be semver");
  });

  it("returns null version for non-existent repo", async () => {
    const { fetchLatestRelease } = await import("../utils.ts");
    const result = await fetchLatestRelease("timaliev/nonexistent-repo-xyz-123");
    assert.equal(result.version, null);
  });
});
