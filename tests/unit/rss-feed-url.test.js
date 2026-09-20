import assert from 'node:assert/strict';
import { normalizeRssFeedUrl } from '../../server/services/rss/feed-url.js';

assert.equal(
  normalizeRssFeedUrl(' https://prowlarr.example/api?apikey=ABC '),
  'https://prowlarr.example/api?apikey=ABC'
);
assert.equal(
  normalizeRssFeedUrl('https://prowlarr.example/api/'),
  'https://prowlarr.example/api'
);
assert.equal(normalizeRssFeedUrl(''), '');

console.log('feed-url: ok');
