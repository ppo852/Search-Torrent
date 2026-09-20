import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRelevantResult,
  splitQueryTitleAndYear,
} from '../../server/services/prowlarr/search.js';

test('isRelevantResult — titre numérique 1923 ne rejette pas sur année 2022', () => {
  assert.equal(
    isRelevantResult('1923.S01.1080p.WEB-DL', '1923', '2022', null),
    true
  );
});

test('isRelevantResult — titre numérique 9101 accepté', () => {
  assert.equal(
    isRelevantResult('9101 1080p BluRay x264', '9101', '2024', null),
    true
  );
});

test('isRelevantResult — titre normal filtre encore l\'année', () => {
  assert.equal(
    isRelevantResult('Lanterns 2021 1080p', 'Lanterns', '2026', null),
    false
  );
  assert.equal(
    isRelevantResult('Lanterns 2026 1080p', 'Lanterns', '2026', null),
    true
  );
});

test('splitQueryTitleAndYear — query 1923 garde le titre', () => {
  assert.deepEqual(splitQueryTitleAndYear('1923'), { title: '1923', year: '' });
  assert.deepEqual(splitQueryTitleAndYear('9101'), { title: '9101', year: '' });
});

test('splitQueryTitleAndYear — titre + année séparés', () => {
  assert.deepEqual(splitQueryTitleAndYear('Lanterns 2026'), {
    title: 'Lanterns',
    year: '2026',
  });
});

test('isRelevantResult — rejette mauvais show avec même SxxExx (Lanterns ≠ Pokemon)', () => {
  assert.equal(
    isRelevantResult(
      'Pokemon.Horizons.S01E04.FRENCH.1080p.WEB.x264-D4KiD',
      ['Lanterns'],
      null,
      1
    ),
    false
  );
  assert.equal(
    isRelevantResult('Lanterns.S01E04.1080p.WEB', ['Lanterns'], null, 1),
    true
  );
});

test('isRelevantResult — rejette Sailor Moon pour Toronto Section Criminelle', () => {
  assert.equal(
    isRelevantResult(
      'Sailor.Moon.R.S02E09.MULTi.1080p.WEB.x264-D4KiD',
      ['Toronto: Section Criminelle', 'Toronto Section Criminelle'],
      null,
      2
    ),
    false
  );
});

test('isRelevantResult — rejette Ghost in the Shell pour The Rookie North', () => {
  assert.equal(
    isRelevantResult(
      'The Ghost In The Shell - S01E01 - Prologue + Super Spartan I - 2160p',
      ['The Rookie: North', 'The Rookie North'],
      null,
      1
    ),
    false
  );
});
