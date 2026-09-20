import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRequestStatusBadge,
  aggregateSeasonStatuses,
} from '../../shared/request-status-labels.js';

test('getRequestStatusBadge — film sent_to_qbit → En Scan', () => {
  const badge = getRequestStatusBadge('sent_to_qbit', 'movie');
  assert.equal(badge.label, 'En Scan');
});

test('getRequestStatusBadge — film downloading → En Scan (attente inventaire)', () => {
  const badge = getRequestStatusBadge('downloading', 'movie');
  assert.equal(badge.label, 'En Scan');
});

test('getRequestStatusBadge — série downloading → En cours', () => {
  const badge = getRequestStatusBadge('downloading', 'tv');
  assert.equal(badge.label, 'En cours');
});

test('getRequestStatusBadge — anime sent_to_qbit → En cours', () => {
  const badge = getRequestStatusBadge('sent_to_qbit', 'anime');
  assert.equal(badge.label, 'En cours');
});

test('getRequestStatusBadge — monitoring → En attente', () => {
  const badge = getRequestStatusBadge('monitoring', 'tv');
  assert.equal(badge.label, 'En attente');
});

test('getRequestStatusBadge — completed → Complet', () => {
  const badge = getRequestStatusBadge('completed', 'tv');
  assert.equal(badge.label, 'Complet');
});

test('getRequestStatusBadge — statut vide → Inconnu', () => {
  const badge = getRequestStatusBadge(null, 'tv');
  assert.equal(badge.label, 'Inconnu');
});

test('aggregateSeasonStatuses — liste vide → monitoring', () => {
  assert.equal(aggregateSeasonStatuses([]), 'monitoring');
});

test('aggregateSeasonStatuses — toutes complètes → completed', () => {
  assert.equal(aggregateSeasonStatuses(['completed', 'already_available']), 'completed');
});

test('aggregateSeasonStatuses — une complète + une en attente → downloading', () => {
  assert.equal(aggregateSeasonStatuses(['completed', 'monitoring']), 'downloading');
});

test('aggregateSeasonStatuses — une en cours → downloading', () => {
  assert.equal(aggregateSeasonStatuses(['monitoring', 'downloading']), 'downloading');
});

test('aggregateSeasonStatuses — erreur prioritaire → error', () => {
  assert.equal(aggregateSeasonStatuses(['completed', 'error', 'monitoring']), 'error');
});

test('aggregateSeasonStatuses — tout en attente → monitoring', () => {
  assert.equal(aggregateSeasonStatuses(['monitoring', 'pending']), 'monitoring');
});
