import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTmdbGenreLabel,
  isBroadcastEpisodicGenres,
  TMDB_TV_TALK_GENRE_ID,
} from '../../shared/tmdb-genres.js';
import { isRelevantResult } from '../../server/services/prowlarr/search.js';

test('getTmdbGenreLabel — Talk → Émission', () => {
  assert.equal(getTmdbGenreLabel({ id: TMDB_TV_TALK_GENRE_ID, name: 'Talk' }), 'Émission');
  assert.equal(getTmdbGenreLabel({ id: 10764, name: 'Reality' }), 'Télé-réalité');
  assert.equal(getTmdbGenreLabel({ id: 878, name: 'Science Fiction' }), 'Science-Fiction');
  assert.equal(getTmdbGenreLabel({ name: 'Talk' }), 'Émission');
});

test('isBroadcastEpisodicGenres — Talk / Reality / News', () => {
  assert.equal(isBroadcastEpisodicGenres([{ id: 10767 }]), true);
  assert.equal(isBroadcastEpisodicGenres([{ id: 18 }]), false);
});

test('émission — année d’épisode 2026 ne rejette pas si filtre année désactivé', () => {
  const name =
    'Un Dimanche A La Campagne S04E14 01 02 2026 French FR2 WEB 1080p H264 AAC';
  // Comme searchTvSeries avec isBroadcastEpisodic : year vide
  assert.equal(
    isRelevantResult(name, ['Un dimanche a la campagne'], '', 4),
    true
  );
  // Série fiction : année 2022 vs 2026 dans le titre → toujours rejeté
  assert.equal(
    isRelevantResult(name, ['Un dimanche a la campagne'], '2022', 4),
    false
  );
});
