import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("compareVersions", () => {
  it("returns 0 for equal versions", async () => {
    const { compareVersions } = await import("../release-monitor.ts");
    assert.equal(compareVersions("v1.0.0", "v1.0.0"), 0);
    assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  });

  it("returns positive when first is newer", async () => {
    const { compareVersions } = await import("../release-monitor.ts");
    assert.ok(compareVersions("v1.0.1", "v1.0.0") > 0);
    assert.ok(compareVersions("v2.0.0", "v1.999.999") > 0);
  });

  it("returns negative when second is newer", async () => {
    const { compareVersions } = await import("../release-monitor.ts");
    assert.ok(compareVersions("v1.0.0", "v1.0.1") < 0);
    assert.ok(compareVersions("v0.0.1", "v1.0.0") < 0);
  });

  it("handles v-prefixed and non-prefixed", async () => {
    const { compareVersions } = await import("../release-monitor.ts");
    assert.equal(compareVersions("v1.1.1", "1.1.1"), 0);
  });

  it("handles major version differences", async () => {
    const { compareVersions } = await import("../release-monitor.ts");
    assert.ok(compareVersions("v2.0.0", "v1.9.9") > 0);
    assert.ok(compareVersions("v1.0.0", "v2.0.0") < 0);
  });

  it("handles minor version differences", async () => {
    const { compareVersions } = await import("../release-monitor.ts");
    assert.ok(compareVersions("v1.2.0", "v1.1.9") > 0);
    assert.ok(compareVersions("v1.0.0", "v1.1.0") < 0);
  });
});
