import test from 'node:test';
import assert from 'node:assert/strict';
import { pickBestTrailer } from '../../src/lib/tmdb-videos.ts';

test('pickBestTrailer — préfère FR même si EN official', () => {
  const picked = pickBestTrailer([
    {
      key: 'en1',
      site: 'YouTube',
      type: 'Trailer',
      name: 'Official Trailer',
      official: true,
      iso_639_1: 'en',
      iso_3166_1: 'US',
    },
    {
      key: 'fr1',
      site: 'YouTube',
      type: 'Trailer',
      name: 'Bande-annonce',
      official: false,
      iso_639_1: 'fr',
      iso_3166_1: 'FR',
    },
  ]);
  assert.equal(picked?.key, 'fr1');
});

test('pickBestTrailer — fallback EN s’il n’y a pas de FR', () => {
  const picked = pickBestTrailer([
    {
      key: 'nl1',
      site: 'YouTube',
      type: 'Trailer',
      name: 'Trailer',
      official: false,
      iso_639_1: 'nl',
    },
    {
      key: 'en1',
      site: 'YouTube',
      type: 'Trailer',
      name: 'Official Trailer',
      official: true,
      iso_639_1: 'en',
    },
  ]);
  assert.equal(picked?.key, 'en1');
});

test('pickBestTrailer — détecte FR via le titre bande-annonce', () => {
  const picked = pickBestTrailer([
    {
      key: 'en1',
      site: 'YouTube',
      type: 'Trailer',
      name: 'Official Trailer',
      official: true,
      iso_639_1: 'en',
    },
    {
      key: 'fr2',
      site: 'YouTube',
      type: 'Trailer',
      name: 'Bande-annonce VF',
      official: true,
    },
  ]);
  assert.equal(picked?.key, 'fr2');
});
