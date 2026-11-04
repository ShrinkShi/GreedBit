'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const H = require('../src/domain/hash.js');

test('sha256Hex: known vectors', () => {
  assert.equal(H.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(H.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256Hex: matches Node crypto for utf8 and long input', () => {
  const samples = ['中文密码', 'a'.repeat(1000), 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), '🎉 emoji'];
  for (const s of samples) {
    const expected = nodeCrypto.createHash('sha256').update(s, 'utf8').digest('hex');
    assert.equal(H.sha256Hex(s), expected, s.slice(0, 12));
  }
});

test('hashPassword: deterministic for the same salt', () => {
  assert.equal(H.hashPassword('secret', 'salt', 10), H.hashPassword('secret', 'salt', 10));
});

test('hashPassword: different salt or password changes the result', () => {
  const base = H.hashPassword('secret', 'salt-a', 10);
  assert.notEqual(base, H.hashPassword('secret', 'salt-b', 10));
  assert.notEqual(base, H.hashPassword('secret2', 'salt-a', 10));
});

test('hashPassword: iterations change the result', () => {
  assert.notEqual(H.hashPassword('secret', 'salt', 10), H.hashPassword('secret', 'salt', 11));
});

test('hashPassword: output is a 64-char hex string', () => {
  assert.match(H.hashPassword('p', 's'), /^[0-9a-f]{64}$/);
});

test('hashPassword: default iteration count is used when omitted', () => {
  assert.equal(H.hashPassword('p', 's'), H.hashPassword('p', 's', H.DEFAULT_ITERATIONS));
});
