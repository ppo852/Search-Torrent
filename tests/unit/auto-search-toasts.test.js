import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMovieAutoSearchToastPayload,
  getTvAutoSearchToastPayload,
} from '../../src/lib/auto-search-toast-payloads.ts';

test('getMovieAutoSearchToastPayload — sent', () => {
  const payload = getMovieAutoSearchToastPayload({ status: 'sent' });
  assert.equal(payload?.variant, 'success');
  assert.match(payload?.message ?? '', /envoyé/i);
});

test('getMovieAutoSearchToastPayload — already_sent', () => {
  const payload = getMovieAutoSearchToastPayload({ status: 'already_sent' });
  assert.equal(payload?.variant, 'info');
  assert.match(payload?.message ?? '', /déjà en cours/i);
});

test('getMovieAutoSearchToastPayload — statut absent → null', () => {
  assert.equal(getMovieAutoSearchToastPayload(null), null);
  assert.equal(getMovieAutoSearchToastPayload({}), null);
});

test('getTvAutoSearchToastPayload — sent_episode', () => {
  const payload = getTvAutoSearchToastPayload({ status: 'sent_episode', episode: 3 });
  assert.equal(payload?.variant, 'success');
  assert.match(payload?.message ?? '', /E3/);
});

test('getTvAutoSearchToastPayload — sent_batch plusieurs épisodes', () => {
  const payload = getTvAutoSearchToastPayload(
    { status: 'sent_batch', downloadedCount: 2 },
    { seasonNumber: 1 }
  );
  assert.equal(payload?.variant, 'success');
  assert.match(payload?.message ?? '', /2 épisodes/);
});

test('getMovieAutoSearchToastPayload — no_results info douce', () => {
  const payload = getMovieAutoSearchToastPayload({ status: 'no_results' });
  assert.equal(payload?.variant, 'info');
  assert.match(payload?.message ?? '', /pas l’instant|essai automatique/i);
});

test('getTvAutoSearchToastPayload — error no_results', () => {
  const payload = getTvAutoSearchToastPayload({ status: 'error', error: 'no_results' });
  // no_results n'est plus exposé comme message d'erreur fiche
  assert.equal(payload?.variant, 'error');
  assert.match(payload?.message ?? '', /échoué|automatique/i);
});
