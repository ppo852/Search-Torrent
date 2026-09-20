import test from 'node:test';
import assert from 'node:assert/strict';
import { isAlreadyPresentConflict } from '../../src/lib/request-conflict.ts';

test('isAlreadyPresentConflict — 409 → true', () => {
  assert.equal(isAlreadyPresentConflict({ status: 409 }), true);
});

test('isAlreadyPresentConflict — autre statut → false', () => {
  assert.equal(isAlreadyPresentConflict({ status: 403 }), false);
  assert.equal(isAlreadyPresentConflict(new Error('fail')), false);
  assert.equal(isAlreadyPresentConflict(null), false);
});
