import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterOrganizrTokenCookies,
  isAllowedOrganizrUrl,
  buildOrganizrAuthUrl,
  extractOrganizrUsername,
} from '../../server/services/auth/organizr.js';

test('filterOrganizrTokenCookies — ne garde que organizr_token_*', () => {
  const raw = 'foo=1; organizr_token_abc=jwt-here; other=2; Organizr_Token_xyz=second';
  const filtered = filterOrganizrTokenCookies(raw);
  assert.match(filtered, /organizr_token_abc=jwt-here/i);
  assert.match(filtered, /Organizr_Token_xyz=second/i);
  assert.doesNotMatch(filtered, /\bfoo=/);
  assert.doesNotMatch(filtered, /\bother=/);
});

test('isAllowedOrganizrUrl — http(s) seulement', () => {
  assert.equal(isAllowedOrganizrUrl('http://organizr'), true);
  assert.equal(isAllowedOrganizrUrl('https://organizr.lab.local'), true);
  assert.equal(isAllowedOrganizrUrl('ftp://evil'), false);
  assert.equal(isAllowedOrganizrUrl('not-a-url'), false);
  assert.equal(isAllowedOrganizrUrl(''), false);
});

test('buildOrganizrAuthUrl — chemin Server Auth', () => {
  assert.equal(
    buildOrganizrAuthUrl('http://lab-organizr/', '998'),
    'http://lab-organizr/api/v2/auth/998'
  );
});

test('extractOrganizrUsername — formats connus', () => {
  assert.equal(
    extractOrganizrUsername({ response: { data: { user: 'alice' } } }),
    'alice'
  );
  assert.equal(extractOrganizrUsername({ data: { username: 'bob' } }), 'bob');
  assert.equal(extractOrganizrUsername({}), '');
});
