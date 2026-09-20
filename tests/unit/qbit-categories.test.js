import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QBIT_CATEGORIES,
  normalizeQbitCategory,
  inferQbitCategoryFromMediaType,
  resolveQbitCategory,
} from '../../shared/qbit-categories.js';

test('normalizeQbitCategory — canonique et alias', () => {
  assert.equal(normalizeQbitCategory('Films'), QBIT_CATEGORIES.MOVIES);
  assert.equal(normalizeQbitCategory('movie'), QBIT_CATEGORIES.MOVIES);
  assert.equal(normalizeQbitCategory('Série'), QBIT_CATEGORIES.TV);
  assert.equal(normalizeQbitCategory('serie tv'), QBIT_CATEGORIES.TV);
  assert.equal(normalizeQbitCategory(''), null);
  assert.equal(normalizeQbitCategory(null), null);
});

test('inferQbitCategoryFromMediaType', () => {
  assert.equal(inferQbitCategoryFromMediaType('movie'), QBIT_CATEGORIES.MOVIES);
  assert.equal(inferQbitCategoryFromMediaType('animation'), QBIT_CATEGORIES.ANIMATION);
  assert.equal(inferQbitCategoryFromMediaType('tv'), QBIT_CATEGORIES.TV);
  assert.equal(inferQbitCategoryFromMediaType('unknown'), null);
});

test('resolveQbitCategory — value puis mediaType', () => {
  assert.equal(resolveQbitCategory('anime', null), QBIT_CATEGORIES.ANIME);
  assert.equal(resolveQbitCategory(null, 'movie'), QBIT_CATEGORIES.MOVIES);
  assert.equal(resolveQbitCategory('inconnu', 'tv'), QBIT_CATEGORIES.TV);
  assert.equal(resolveQbitCategory('inconnu', 'unknown'), null);
});
