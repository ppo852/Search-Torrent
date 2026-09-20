import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEpisodeRange } from '../../shared/format-episode-range.js';

test('formatEpisodeRange — un épisode', () => {
  assert.equal(formatEpisodeRange([1]), 'Ép. 1');
});

test('formatEpisodeRange — plage contiguë', () => {
  assert.equal(formatEpisodeRange([1, 2, 3, 4, 5, 6, 7]), 'Ép. 1 à 7');
});

test('formatEpisodeRange — épisodes non contigus (trous)', () => {
  assert.equal(formatEpisodeRange([1, 3, 5]), 'Ép. 1, 3, 5');
  assert.equal(
    formatEpisodeRange([161, 162, 163, 170, 171, 172, 178, 179]),
    'Ép. 161 à 163, 170 à 172, 178 à 179'
  );
});

test('formatEpisodeRange — liste vide', () => {
  assert.equal(formatEpisodeRange([]), null);
  assert.equal(formatEpisodeRange(null), null);
});
