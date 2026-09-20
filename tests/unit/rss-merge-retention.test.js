import assert from 'node:assert/strict';
import {
  getRssItemKey,
  mergeRssItemsWithRetention,
  dedupeRssItems,
  parseCachedRssItems,
  RSS_ITEM_RETENTION_HOURS,
} from '../../server/services/rss/merge-retention.js';

const NOW = Date.parse('2026-09-15T12:00:00.000Z');

function hoursAgo(hours) {
  return new Date(NOW - hours * 60 * 60 * 1000).toISOString();
}

function item(partial) {
  return {
    title: 'Film',
    link: 'https://tracker.example/a',
    pubDate: hoursAgo(1),
    ...partial,
  };
}

assert.equal(RSS_ITEM_RETENTION_HOURS, 24);
assert.equal(getRssItemKey(item({ link: 'HTTPS://X/Y ' })), 'l:https://x/y');
assert.equal(
  getRssItemKey(
    item({
      title: 'Blood.Freak.1972.DVDRip',
      size: 2540000000,
      link: 'https://ygg/a',
    })
  ),
  's:blood.freak.1972.dvdrip|2540000000'
);
assert.equal(
  getRssItemKey(
    item({
      infohash: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
      title: 'Other',
      size: 1,
      link: 'https://ignored',
    })
  ),
  'h:abcdef0123456789abcdef0123456789abcdef01'
);
assert.deepEqual(parseCachedRssItems('not-json'), []);
assert.deepEqual(parseCachedRssItems('[{"title":"A"}]'), [{ title: 'A' }]);

{
  const previous = [
    item({ link: 'https://t/1', title: 'Old keep', pubDate: hoursAgo(2) }),
    item({ link: 'https://t/old', title: 'Too old', pubDate: hoursAgo(30) }),
  ];
  const fresh = [
    item({ link: 'https://t/2', title: 'New', pubDate: hoursAgo(0.5) }),
  ];
  const merged = mergeRssItemsWithRetention(previous, fresh, { nowMs: NOW, retentionHours: 24 });
  const links = merged.map((i) => i.link).sort();
  assert.deepEqual(links, ['https://t/1', 'https://t/2']);
}

{
  const previous = [
    item({
      link: 'https://t/same',
      title: 'V1',
      pubDate: hoursAgo(3),
      tmdb: { tmdb_id: 42, title: 'Movie' },
    }),
  ];
  const fresh = [
    item({ link: 'https://t/same', title: 'V2', pubDate: hoursAgo(3) }),
  ];
  const merged = mergeRssItemsWithRetention(previous, fresh, { nowMs: NOW });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].tmdb.tmdb_id, 42);
}

{
  const previous = [item({ link: 'https://t/nodate', title: 'NoDate', pubDate: '' })];
  const fresh = [item({ link: 'https://t/ok', pubDate: hoursAgo(1) })];
  const merged = mergeRssItemsWithRetention(previous, fresh, { nowMs: NOW });
  assert.deepEqual(merged.map((i) => i.link), ['https://t/ok']);
}

{
  const previous = [item({ link: 'https://t/nodate', title: 'NoDate', pubDate: '' })];
  const fresh = [item({ link: 'https://t/nodate', title: 'NoDate', pubDate: '' })];
  const merged = mergeRssItemsWithRetention(previous, fresh, { nowMs: NOW });
  assert.equal(merged.length, 1);
}

{
  // Même release, liens différents → 1 ligne ; autre taille → gardée
  const title = 'Blood.Freak.1972.SPECIAL.EDITION.MULTi.VFF.CUSTOM.480p.DVDRip.AC3.x264-eMux.FRENCH';
  const dupes = [
    item({ title, size: 2540000000, link: 'https://ygg/dl/1', pubDate: hoursAgo(1) }),
    item({ title, size: 2540000000, link: 'https://ygg/dl/2', pubDate: hoursAgo(1) }),
    item({
      title: 'Blood.Freak.1972.SPECIAL.EDITION.MULTi.VFF.CUSTOM.480i.DVD.REMUX.AC3.MPEG2-eMux.FRENCH',
      size: 2730000000,
      link: 'https://ygg/dl/3',
      pubDate: hoursAgo(1),
    }),
  ];
  const deduped = dedupeRssItems(dupes);
  assert.equal(deduped.length, 2);
  const sizes = deduped.map((i) => i.size).sort((a, b) => a - b);
  assert.deepEqual(sizes, [2540000000, 2730000000]);
}

console.log('merge-retention: ok');
