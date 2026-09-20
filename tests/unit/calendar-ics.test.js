import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventsToIcs,
  generateCalendarApiKey,
} from '../../server/services/calendar/index.js';
import { foldIcsLine } from '../../server/services/calendar/ics.js';

test('generateCalendarApiKey — hex 64 chars', () => {
  const key = generateCalendarApiKey();
  assert.equal(key.length, 64);
  assert.match(key, /^[a-f0-9]+$/);
});

test('foldIcsLine — coupe en octets UTF-8 (accents)', () => {
  // "é" = 2 octets ; 40 × é = 80 octets > 75, mais seulement 40 chars JS
  const line = `SUMMARY:${'é'.repeat(40)}`;
  assert.ok(line.length < 75);
  assert.ok(Buffer.byteLength(line, 'utf8') > 75);

  const folded = foldIcsLine(line);
  const segments = folded.split('\r\n');
  assert.ok(segments.length >= 2);
  for (const seg of segments) {
    assert.ok(Buffer.byteLength(seg, 'utf8') <= 75, `ligne trop longue: ${Buffer.byteLength(seg, 'utf8')}`);
  }
  const unfolded = segments.map((s, i) => (i === 0 ? s : s.replace(/^ /, ''))).join('');
  assert.equal(unfolded, line);
});

test('eventsToIcs — produit un VEVENT valide', () => {
  const ics = eventsToIcs(
    [
      {
        id: 'tv-123-1-2',
        title: 'Show, Test',
        season: 1,
        episode: 2,
        episodeTitle: 'Pilot; Day 1',
        airDate: '2026-09-15',
        tmdbId: 123,
        mediaType: 'tv',
        summary: 'Show, Test - S01E02 - Pilot; Day 1',
      },
    ],
    { start: '2026-09-01', end: '2026-09-30' }
  );

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260915/);
  assert.match(ics, /DTEND;VALUE=DATE:20260916/);
  assert.match(ics, /UID:st-tv-123-1-2@search-torrent/);
  assert.match(ics, /SUMMARY:Show\\, Test - S01E02 - Pilot\\; Day 1/);
  assert.match(ics, /END:VCALENDAR/);
});
