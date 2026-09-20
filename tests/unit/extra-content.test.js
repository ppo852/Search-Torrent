import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMovieExtraTorrent,
  shouldApplyMovieExtraFilter,
  expandTitleVariantsForRelevance,
} from '../../server/services/utils/extra-content.js';
import { isRelevantResult } from '../../server/services/prowlarr/search.js';

const ODYSSEY_MAKING_OF =
  'The.Odyssey.Making.Of.2026.DOC.MULTi.VFF.AD.1080p.WEB.EAC3.5.1.x264-BYOR';

test('isMovieExtraTorrent — making-of L\'Odyssée bloqué', () => {
  assert.equal(
    isMovieExtraTorrent(ODYSSEY_MAKING_OF, { titleVariants: ["L'Odyssée", 'The Odyssey'] }),
    true
  );
});

test('isMovieExtraTorrent — vrai film Odyssey accepté', () => {
  assert.equal(
    isMovieExtraTorrent('The.Odyssey.2026.MULTi.1080p.WEB-DL.x264-GROUP', {
      titleVariants: ["L'Odyssée", 'The Odyssey'],
    }),
    false
  );
});

test('isMovieExtraTorrent — Doc Hollywood non bloqué', () => {
  assert.equal(
    isMovieExtraTorrent('Doc.Hollywood.1991.1080p.BluRay.x264', {
      titleVariants: ['Doc Hollywood'],
    }),
    false
  );
});

test('isMovieExtraTorrent — making-of Doc Hollywood bloqué', () => {
  assert.equal(
    isMovieExtraTorrent('Doc.Hollywood.Making.Of.1991.1080p', {
      titleVariants: ['Doc Hollywood'],
    }),
    true
  );
});

test('shouldApplyMovieExtraFilter — documentaire / making-of / classique', () => {
  assert.equal(
    shouldApplyMovieExtraFilter({ isDocumentary: true, titleVariants: ['Planète Terre'] }),
    false
  );
  assert.equal(
    shouldApplyMovieExtraFilter({
      isDocumentary: false,
      titleVariants: ['Making of The Odyssey'],
    }),
    false
  );
  assert.equal(
    shouldApplyMovieExtraFilter({
      isDocumentary: false,
      titleVariants: ["L'Odyssée", 'The Odyssey'],
    }),
    true
  );
});

test('pertinence — fiche making-of TMDB match release Making.Of', () => {
  const titles = expandTitleVariantsForRelevance(['The Odyssey: The Making of an Epic']);
  assert.ok(titles.includes('The Odyssey'));
  assert.equal(isRelevantResult(ODYSSEY_MAKING_OF, titles, '2026'), true);
  assert.deepEqual(expandTitleVariantsForRelevance(['The Odyssey']), ['The Odyssey']);
});
