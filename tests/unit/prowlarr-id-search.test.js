import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProwlarrTvSearchQuery,
  buildProwlarrMovieSearchQuery,
} from '../../server/services/prowlarr/id-query.js';

test('buildProwlarrTvSearchQuery — TVDB + saison + épisode', () => {
  assert.equal(
    buildProwlarrTvSearchQuery({ tvdbId: 12345, seasonNumber: 2, episodeNumber: 1 }),
    '{TvdbId:12345} {Season:2} {Episode:1}'
  );
});

test('buildProwlarrTvSearchQuery — TMDB si pas de TVDB', () => {
  assert.equal(
    buildProwlarrTvSearchQuery({ tmdbId: 999, seasonNumber: 1 }),
    '{TmdbId:999} {Season:1}'
  );
});

test('buildProwlarrTvSearchQuery — IMDb normalisé', () => {
  assert.equal(
    buildProwlarrTvSearchQuery({ imdbId: '1234567', seasonNumber: 1, episodeNumber: 3 }),
    '{ImdbId:tt1234567} {Season:1} {Episode:3}'
  );
});

test('buildProwlarrTvSearchQuery — vide sans ID', () => {
  assert.equal(buildProwlarrTvSearchQuery({ seasonNumber: 1 }), '');
});

test('buildProwlarrMovieSearchQuery — TMDB seul (pas de Year)', () => {
  assert.equal(
    buildProwlarrMovieSearchQuery({ tmdbId: 425274, year: 2026 }),
    '{TmdbId:425274}'
  );
});

test('buildProwlarrMovieSearchQuery — IMDb si pas de TMDB', () => {
  assert.equal(
    buildProwlarrMovieSearchQuery({ imdbId: 'tt1234567', year: 2024 }),
    '{ImdbId:tt1234567}'
  );
});

test('buildProwlarrMovieSearchQuery — vide sans ID', () => {
  assert.equal(buildProwlarrMovieSearchQuery({ year: 2026 }), '');
});
