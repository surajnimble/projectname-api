/**
 * Semantic-version comparison for app builds.
 *
 * App versions arrive as free-form strings from a header, so the comparator has
 * to tolerate a `v` prefix, a missing minor or patch, and trailing build
 * metadata rather than throwing on the malformed shapes real clients send.
 */

/**
 * Splits a version into its numeric segments, discarding any build metadata.
 * Non-numeric runs collapse to zero, so `1.2` and `1.2.0` compare equal.
 */
const segments = (version: string): number[] =>
  String(version ?? '')
    .trim()
    .replace(/^[vV]/, '')
    .split(/[.\-+]/)
    .slice(0, 3)
    .map((part) => {
      const digits = part.match(/^\d+/);
      return digits ? Number(digits[0]) : 0;
    });

/**
 * Reports whether `current` is strictly older than `minimum`.
 *
 * An unparseable or empty value returns `false` rather than `true`: a client
 * that does not identify its version cannot be told to update, and blocking
 * every such caller would lock out browsers, curl and the health checks.
 */
export const isVersionOlderThan = (current: string, minimum: string): boolean => {
  const currentParts = segments(current);
  const minimumParts = segments(minimum);

  const blank = !current.trim() || !minimum.trim();
  const currentIsNumber = /\d/.test(current);
  const minimumIsNumber = /\d/.test(minimum);
  if (blank || !currentIsNumber || !minimumIsNumber) return false;

  const length = Math.max(currentParts.length, minimumParts.length);
  for (let i = 0; i < length; i += 1) {
    const a = currentParts[i] ?? 0;
    const b = minimumParts[i] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }

  return false;
};
