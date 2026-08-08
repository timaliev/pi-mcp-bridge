import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("expandEnvVars", () => {
  it("replaces ${VAR} with environment variable value", async () => {
    const saved = process.env.TEST_FOO;
    try {
      process.env.TEST_FOO = "bar";
      const { expandEnvVars } = await import("../utils.ts");
      assert.equal(expandEnvVars("prefix_${TEST_FOO}_suffix"), "prefix_bar_suffix");
    } finally {
      if (saved !== undefined) process.env.TEST_FOO = saved;
      else delete process.env.TEST_FOO;
    }
  });

  it("replaces $VAR (no braces) with environment variable value", async () => {
    const saved = process.env.TEST_BAR;
    try {
      process.env.TEST_BAR = "baz";
      const { expandEnvVars } = await import("../utils.ts");
      assert.equal(expandEnvVars("$TEST_BAR"), "baz");
    } finally {
      if (saved !== undefined) process.env.TEST_BAR = saved;
      else delete process.env.TEST_BAR;
    }
  });

  it("replaces multiple variables in same string", async () => {
    const savedA = process.env.A;
    const savedB = process.env.B;
    try {
      process.env.A = "1";
      process.env.B = "2";
      const { expandEnvVars } = await import("../utils.ts");
      assert.equal(expandEnvVars("${A}x${B}"), "1x2");
    } finally {
      if (savedA !== undefined) process.env.A = savedA; else delete process.env.A;
      if (savedB !== undefined) process.env.B = savedB; else delete process.env.B;
    }
  });

  it("returns empty string for missing env vars", async () => {
    const { expandEnvVars } = await import("../utils.ts");
    assert.equal(expandEnvVars("${MISSING_VAR_XYZ_123}"), "");
  });

  it("returns original string when no variables present", async () => {
    const { expandEnvVars } = await import("../utils.ts");
    assert.equal(expandEnvVars("plain text no vars"), "plain text no vars");
  });

  it("handles mixed braces styles", async () => {
    const savedA = process.env.A;
    const savedB = process.env.B;
    try {
      process.env.A = "alpha";
      process.env.B = "beta";
      const { expandEnvVars } = await import("../utils.ts");
      assert.equal(expandEnvVars("${A}_$B"), "alpha_beta");
    } finally {
      if (savedA !== undefined) process.env.A = savedA; else delete process.env.A;
      if (savedB !== undefined) process.env.B = savedB; else delete process.env.B;
    }
  });
});

describe("parseSemver", () => {
  it("parses standard version", async () => {
    const { parseSemver } = await import("../utils.ts");
    assert.deepEqual(parseSemver("1.2.3"), [1, 2, 3]);
  });

  it("parses v-prefixed version", async () => {
    const { parseSemver } = await import("../utils.ts");
    assert.deepEqual(parseSemver("v1.2.3"), [1, 2, 3]);
  });

  it("returns null for non-semver strings", async () => {
    const { parseSemver } = await import("../utils.ts");
    assert.equal(parseSemver("not-a-version"), null);
    assert.equal(parseSemver(""), null);
  });

  it("handles multi-digit versions", async () => {
    const { parseSemver } = await import("../utils.ts");
    assert.deepEqual(parseSemver("10.20.300"), [10, 20, 300]);
  });

  it("extracts semver from longer strings", async () => {
    const { parseSemver } = await import("../utils.ts");
    assert.deepEqual(parseSemver("1.2.3-beta.1"), [1, 2, 3]);
  });
});

describe("isNewer", () => {
  it("returns true when latest has higher major", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("v2.0.0", "v1.9.9"), true);
  });

  it("returns false when latest has lower major", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("v1.0.0", "v2.0.0"), false);
  });

  it("returns true when latest has higher minor (same major)", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("v1.3.0", "v1.2.9"), true);
  });

  it("returns true when latest has higher patch (same major/minor)", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("v1.3.2", "v1.3.1"), true);
  });

  it("returns false for same version", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("v1.3.1", "v1.3.1"), false);
  });

  it("returns false when latest is older", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("v1.3.0", "v1.3.1"), false);
  });

  it("handles non-v-prefixed versions", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("1.3.2", "1.3.1"), true);
  });

  it("returns false for invalid version strings", async () => {
    const { isNewer } = await import("../utils.ts");
    assert.equal(isNewer("not-valid", "v1.0.0"), false);
    assert.equal(isNewer("v1.0.0", "not-valid"), false);
  });
});
