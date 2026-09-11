const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeStreamUrl,
  stripMassMentions,
  isValidTimeZone,
  clampDiscordContent,
} = require('../src/util/sanitize');

describe('sanitizeStreamUrl', () => {
  it('allows empty', () => {
    assert.deepEqual(sanitizeStreamUrl(''), { ok: true, url: '' });
    assert.deepEqual(sanitizeStreamUrl(null), { ok: true, url: '' });
  });

  it('allows known stream hosts', () => {
    assert.equal(sanitizeStreamUrl('https://twitch.tv/someone').ok, true);
    assert.equal(sanitizeStreamUrl('https://www.youtube.com/watch?v=abc').ok, true);
    assert.equal(sanitizeStreamUrl('https://kick.com/x').ok, true);
  });

  it('rejects non-http and unknown hosts', () => {
    assert.equal(sanitizeStreamUrl('javascript:alert(1)').ok, false);
    assert.equal(sanitizeStreamUrl('https://evil.example/phish').ok, false);
    assert.equal(sanitizeStreamUrl('not a url').ok, false);
  });
});

describe('stripMassMentions', () => {
  it('neutralizes @everyone and @here', () => {
    const out = stripMassMentions('hi @everyone and @here');
    assert.ok(!out.includes('@everyone'));
    assert.ok(!out.includes('@here'));
    assert.ok(out.includes('everyone'));
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones', () => {
    assert.equal(isValidTimeZone('Asia/Manila'), true);
    assert.equal(isValidTimeZone('UTC'), true);
  });
  it('rejects garbage', () => {
    assert.equal(isValidTimeZone('Not/AZone'), false);
    assert.equal(isValidTimeZone(''), false);
  });
});

describe('clampDiscordContent', () => {
  it('passes short strings', () => {
    assert.equal(clampDiscordContent('hi'), 'hi');
  });
  it('truncates long strings', () => {
    const long = 'x'.repeat(2500);
    const out = clampDiscordContent(long, 2000);
    assert.ok(out.length <= 2000);
    assert.ok(out.includes('truncated'));
  });
});
