import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRequestErrorMessage,
  EPISODE_FAILED_LABEL,
  EPISODE_RETRY_HINT,
  SEASON_FAILED_COUNTER_LABEL,
} from '../../src/lib/request-error-messages.ts';

test('formatRequestErrorMessage — vide → null', () => {
  assert.equal(formatRequestErrorMessage(null), null);
  assert.equal(formatRequestErrorMessage(''), null);
  assert.equal(formatRequestErrorMessage('   '), null);
});

test('formatRequestErrorMessage — no_results (pas encore dispo) → null', () => {
  assert.equal(formatRequestErrorMessage('no_results'), null);
  assert.equal(
    formatRequestErrorMessage(
      'Aucun torrent compatible trouvé. Réessaie plus tard ou lance une recherche manuelle.'
    ),
    null
  );
});

test('formatRequestErrorMessage — qBittorrent absent', () => {
  const msg = formatRequestErrorMessage('download_missing_in_qbit');
  assert.match(msg, /qBittorrent/);
});

test('formatRequestErrorMessage — réseau', () => {
  const msg = formatRequestErrorMessage('ECONNREFUSED fetch failed');
  assert.match(msg, /Connexion impossible/);
});

test('formatRequestErrorMessage — message court inchangé', () => {
  assert.equal(formatRequestErrorMessage('Erreur personnalisée'), 'Erreur personnalisée');
});

test('formatRequestErrorMessage — message long → générique', () => {
  const long = 'x'.repeat(200);
  const msg = formatRequestErrorMessage(long);
  assert.match(msg, /recherche automatique a échoué/i);
});

test('libellés épisode exportés', () => {
  assert.equal(EPISODE_FAILED_LABEL, 'Échec');
  assert.equal(SEASON_FAILED_COUNTER_LABEL, 'Échecs');
  assert.match(EPISODE_RETRY_HINT, /Relance/);
});
