const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { steam32FromInput, toSteam64, STEAM64_BASE } = require('../src/util/steamId');

describe('steam32FromInput', () => {
  it('parses Steam32 digits', () => {
    assert.equal(steam32FromInput('123456789'), 123456789);
    assert.equal(steam32FromInput(' 42 '), 42);
  });

  it('converts Steam64', () => {
    const steam32 = 86123456;
    const steam64 = (BigInt(steam32) + STEAM64_BASE).toString();
    assert.equal(steam64.length, 17);
    assert.equal(steam32FromInput(steam64), steam32);
  });

  it('rejects junk', () => {
    assert.equal(steam32FromInput(''), null);
    assert.equal(steam32FromInput('abc'), null);
    assert.equal(steam32FromInput('-1'), null);
    assert.equal(steam32FromInput('0'), null);
    assert.equal(steam32FromInput('12.5'), null);
    assert.equal(steam32FromInput('1e9'), null);
    assert.equal(steam32FromInput('99999999999999999999'), null); // not 17-digit steam64, too big
  });

  it('round-trips via toSteam64', () => {
    assert.equal(steam32FromInput(toSteam64(1001)), 1001);
  });
});
