import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, DEFAULT_LANG, LANG_STORAGE_KEY, BN, translate } from './i18n.js';

test('constants', () => {
  assert.deepEqual(LANGS, ['en', 'bn']);
  assert.equal(DEFAULT_LANG, 'en');
  assert.equal(LANG_STORAGE_KEY, 'soupresso_lang');
});

test('translate: en is identity', () => {
  assert.equal(translate('en', 'Save quantities'), 'Save quantities');
  assert.equal(translate('en', 'anything at all'), 'anything at all');
});

test('translate: bn uses the dictionary, unknown falls back to key', () => {
  assert.equal(translate('bn', 'Daily Entry'), BN['Daily Entry']);
  assert.equal(translate('bn', 'a string not in the dict'), 'a string not in the dict');
});

test('every BN entry is a non-empty string and not identical to its key', () => {
  for (const [key, value] of Object.entries(BN)) {
    assert.equal(typeof value, 'string', `${key} -> non-string`);
    assert.ok(value.trim().length > 0, `${key} -> empty`);
    assert.notEqual(value, key, `${key} -> maps to itself`);
  }
});
