const STEAM64_BASE = 76561197960265728n;

/**
 * Parse Steam32 or Steam64 input into a positive Steam32 number.
 * @returns {number|null}
 */
function steam32FromInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d{17}$/.test(s)) {
    const n = Number(BigInt(s) - STEAM64_BASE);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  // Reject scientific notation / floats / junk
  if (!/^\d{1,16}$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Steam32 fits in 32-bit unsigned; reject absurd values that are neither 32 nor 64.
  if (n > 0xffffffff) return null;
  return n;
}

function toSteam64(steam32) {
  return (BigInt(steam32) + STEAM64_BASE).toString();
}

module.exports = { steam32FromInput, toSteam64, STEAM64_BASE };
