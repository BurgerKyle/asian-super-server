/**
 * Small input sanitizers for slash-command / Discord content.
 */

const ALLOWED_STREAM_HOSTS = new Set([
  'twitch.tv',
  'www.twitch.tv',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'kick.com',
  'www.kick.com',
]);

/**
 * Accept http(s) stream URLs only. Empty string is allowed (clears / omits).
 * Returns { ok: true, url } or { ok: false, error }.
 */
function sanitizeStreamUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return { ok: true, url: '' };
  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    return { ok: false, error: 'Stream URL must be a valid http(s) link.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Stream URL must use http or https.' };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    ALLOWED_STREAM_HOSTS.has(host) ||
    host.endsWith('.twitch.tv') ||
    host.endsWith('.youtube.com');
  if (!allowed) {
    return {
      ok: false,
      error: 'Stream URL host must be Twitch, YouTube, or Kick.',
    };
  }
  return { ok: true, url: parsed.toString() };
}

/** Strip mass-ping tokens from free-text notes. */
function stripMassMentions(text) {
  return String(text || '')
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere');
}

function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Clamp Discord message content to the 2000-char hard limit. */
function clampDiscordContent(text, limit = 2000) {
  const s = String(text || '');
  if (s.length <= limit) return s;
  const suffix = '\n…_(truncated)_';
  const keep = Math.max(0, limit - suffix.length);
  return s.slice(0, keep) + suffix;
}

module.exports = {
  sanitizeStreamUrl,
  stripMassMentions,
  isValidTimeZone,
  clampDiscordContent,
  ALLOWED_STREAM_HOSTS,
};
