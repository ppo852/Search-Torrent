import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEpisodeRange } from '../../shared/format-episode-range.js';

test('formatEpisodeRange — un épisode', () => {
  assert.equal(formatEpisodeRange([1]), 'Ép. 1');
});

test('formatEpisodeRange — plage contiguë', () => {
  assert.equal(formatEpisodeRange([1, 2, 3, 4, 5, 6, 7]), 'Ép. 1 à 7');
});

test('formatEpisodeRange — épisodes non contigus', () => {
  assert.equal(formatEpisodeRange([1, 3, 5]), '3 ép.');
});

test('formatEpisodeRange — liste vide', () => {
  assert.equal(formatEpisodeRange([]), null);
  assert.equal(formatEpisodeRange(null), null);
});
