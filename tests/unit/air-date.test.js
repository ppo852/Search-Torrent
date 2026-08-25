import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEpisodeAiredNow,
  filterAiredEpisodes,
  getAiredEpisodeNumbers,
} from '../../server/services/tmdb/episodes.js';

const NOW = new Date('2026-08-22T12:00:00.000Z').getTime();

test('isEpisodeAiredNow — sans date', () => {
  assert.equal(isEpisodeAiredNow(null, NOW), true);
  assert.equal(isEpisodeAiredNow('', NOW), true);
});

test('isEpisodeAiredNow — date passée ou future', () => {
  assert.equal(isEpisodeAiredNow('2026-08-01', NOW), true);
  assert.equal(isEpisodeAiredNow('2026-09-01', NOW), false);
});

test('getAiredEpisodeNumbers — filtre les épisodes diffusés', () => {
  const episodes = [
    { episodeNumber: 1, airDate: '2026-08-01' },
    { episodeNumber: 2, airDate: '2026-09-01' },
    { episodeNumber: 3, airDate: null },
  ];

  assert.deepEqual(getAiredEpisodeNumbers(episodes, NOW), [1, 3]);
  assert.equal(filterAiredEpisodes(episodes, NOW).length, 2);
});
