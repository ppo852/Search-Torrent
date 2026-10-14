import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectQuickMovieResult,
  selectQuickSeasonPack,
  quickDownloadMovie,
  quickDownloadTvSeason,
} from '../../server/services/prowlarr/quick-download.js';

test('selectQuickMovieResult — prend le premier résultat trié', () => {
  const picked = selectQuickMovieResult([
    { name: 'Best.Film.2026.1080p', link: 'magnet:?xt=urn:btih:aaa' },
    { name: 'Other.Film.720p', link: 'magnet:?xt=urn:btih:bbb' },
  ]);
  assert.equal(picked.ok, true);
  assert.equal(picked.best.name, 'Best.Film.2026.1080p');
});

test('selectQuickMovieResult — no_results si liste vide ou sans link', () => {
  assert.equal(selectQuickMovieResult([]).reason, 'no_results');
  assert.equal(selectQuickMovieResult([{ name: 'NoLink' }]).reason, 'no_results');
  assert.equal(selectQuickMovieResult(null).reason, 'no_results');
});

test('selectQuickSeasonPack — garde uniquement les packs complets', () => {
  const picked = selectQuickSeasonPack([
    { name: 'Show.S01E01.1080p', link: 'magnet:?xt=urn:btih:ep' },
    { name: 'Show.S01.COMPLETE.1080p', link: 'magnet:?xt=urn:btih:pack' },
    { name: 'Show.S01E02.720p', link: 'magnet:?xt=urn:btih:ep2' },
  ]);
  assert.equal(picked.ok, true);
  assert.equal(picked.best.name, 'Show.S01.COMPLETE.1080p');
});

test('selectQuickSeasonPack — no_pack si seulement des épisodes', () => {
  const picked = selectQuickSeasonPack([
    { name: 'Show.S01E01.1080p', link: 'magnet:?xt=urn:btih:ep' },
    { name: 'Show.S01E02.1080p', link: 'magnet:?xt=urn:btih:ep2' },
  ]);
  assert.equal(picked.ok, false);
  assert.equal(picked.reason, 'no_pack');
});

test('quickDownloadMovie — invalid_params sans titre ou user', async () => {
  const a = await quickDownloadMovie({ userId: 'u1', title: '' });
  assert.equal(a.ok, false);
  assert.equal(a.reason, 'invalid_params');

  const b = await quickDownloadMovie({ userId: null, title: 'Film' });
  assert.equal(b.ok, false);
  assert.equal(b.reason, 'invalid_params');
});

test('quickDownloadTvSeason — invalid_params saison invalide', async () => {
  const a = await quickDownloadTvSeason({
    userId: 'u1',
    title: 'Show',
    seasonNumber: 0,
  });
  assert.equal(a.ok, false);
  assert.equal(a.reason, 'invalid_params');

  const b = await quickDownloadTvSeason({
    userId: 'u1',
    title: 'Show',
    seasonNumber: 'abc',
  });
  assert.equal(b.ok, false);
  assert.equal(b.reason, 'invalid_params');
});
