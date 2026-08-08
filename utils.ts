/**
 * Shared utility functions — pure, zero dependencies, testable standalone.
 */

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
