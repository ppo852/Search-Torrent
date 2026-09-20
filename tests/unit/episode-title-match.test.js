import test from 'node:test';
import assert from 'node:assert/strict';
import { isEpisodeTorrentTitle } from '../../server/services/utils/episode-title.js';

test('isEpisodeTorrentTitle — S01E05 pour S1E5', () => {
  assert.equal(isEpisodeTorrentTitle('Show.S01E05.1080p', 1, 5), true);
});

test('isEpisodeTorrentTitle — 1x05 pour S1E5', () => {
  assert.equal(isEpisodeTorrentTitle('Show.1x05.1080p', 1, 5), true);
});

test('isEpisodeTorrentTitle — 01x05 pour S1E5', () => {
  assert.equal(isEpisodeTorrentTitle('Show.01x05.1080p', 1, 5), true);
});

test('isEpisodeTorrentTitle — S1E5 non reconnu', () => {
  assert.equal(isEpisodeTorrentTitle('Show.S1E5.1080p', 1, 5), false);
});

test('isEpisodeTorrentTitle — S10E05 ne matche pas S1E5', () => {
  assert.equal(isEpisodeTorrentTitle('Show.S10E05.1080p', 1, 5), false);
});

test('isEpisodeTorrentTitle — 10x05 pour S10E5', () => {
  assert.equal(isEpisodeTorrentTitle('Show.10x05.1080p', 10, 5), true);
});

test('isEpisodeTorrentTitle — pack saison sans épisode', () => {
  assert.equal(isEpisodeTorrentTitle('Show.S01.Complete.1080p', 1, 5), false);
});
