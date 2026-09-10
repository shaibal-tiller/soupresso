import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BN_DIGITS,
  toLocaleDigits,
  parseLocaleNumber,
  coerceLocaleNumber,
  formatNumber,
  formatTaka,
} from './numerals.js';

test('BN_DIGITS is the ten Bangla digits', () => {
  assert.equal(BN_DIGITS, '০১২৩৪৫৬৭৮৯');
});

test('parseLocaleNumber: Western', () => {
  assert.equal(parseLocaleNumber('1500'), 1500);
  assert.equal(parseLocaleNumber('1,500'), 1500);
  assert.equal(parseLocaleNumber('1,50,000'), 150000);
  assert.equal(parseLocaleNumber('12.50'), 12.5);
  assert.equal(parseLocaleNumber('-500'), -500);
  assert.equal(parseLocaleNumber('0'), 0);
});

test('parseLocaleNumber: Bangla', () => {
  assert.equal(parseLocaleNumber('১৫০০'), 1500);
  assert.equal(parseLocaleNumber('১,৫০০'), 1500);
  assert.equal(parseLocaleNumber('১২.৫০'), 12.5);
  assert.equal(parseLocaleNumber('০'), 0);
});

test('parseLocaleNumber: mixed and noisy', () => {
  assert.equal(parseLocaleNumber('১5০0'), 1500);
  assert.equal(parseLocaleNumber('  ৳ 1,500 '), 1500);
  assert.equal(parseLocaleNumber('৳১৫০০'), 1500);
});

test('parseLocaleNumber: blank / malformed -> null', () => {
  assert.equal(parseLocaleNumber(''), null);
  assert.equal(parseLocaleNumber('   '), null);
  assert.equal(parseLocaleNumber(null), null);
  assert.equal(parseLocaleNumber(undefined), null);
  assert.equal(parseLocaleNumber('abc'), null);
  assert.equal(parseLocaleNumber('1.2.3'), null);
  assert.equal(parseLocaleNumber('--5'), null);
  assert.equal(parseLocaleNumber('1e5'), null);
});

test('coerceLocaleNumber', () => {
  assert.equal(coerceLocaleNumber(1500), 1500);
  assert.equal(coerceLocaleNumber('১৫০০'), 1500);
  assert.equal(coerceLocaleNumber(null), null);
  assert.equal(coerceLocaleNumber({}), null);
  assert.equal(coerceLocaleNumber(Number.NaN), null);
});

test('toLocaleDigits', () => {
  assert.equal(toLocaleDigits('৳1,500.50', 'bn'), '৳১,৫০০.৫০');
  assert.equal(toLocaleDigits('৳1,500.50', 'en'), '৳1,500.50');
  assert.equal(toLocaleDigits('Wed, Sep 10 2026', 'bn'), 'Wed, Sep ১০ ২০২৬');
});

test('formatNumber', () => {
  assert.equal(formatNumber(1500, 'en'), '1,500');
  assert.equal(formatNumber(150000, 'en'), '150,000');
  assert.equal(formatNumber(1500, 'bn'), '১,৫০০');
  assert.equal(formatNumber(150000, 'bn'), '১,৫০,০০০');
});

test('formatTaka: en unchanged, bn Bangla digits, negative sign', () => {
  assert.equal(formatTaka(1500), formatTaka(1500, 'en'));
  assert.equal(formatTaka(1500, 'en'), '৳1,500');
  assert.match(formatTaka(1500, 'bn'), /^৳[০-৯,]+$/);
  assert.doesNotMatch(formatTaka(1500, 'bn'), /[0-9]/);
  assert.equal(formatTaka(-1500, 'en'), '−৳1,500');
});
