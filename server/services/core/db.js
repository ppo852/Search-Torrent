import sqlite3 from 'sqlite3';
import config from './config.js';

const db = new sqlite3.Database(config.paths.db);

/** File d’attente : une section critique DB à la fois (évite BEGIN imbriqués). */
let exclusiveChain = Promise.resolve();

/**
 * Exécute fn sans qu’une autre withDbExclusive tourne en parallèle.
 * Obligatoire autour de BEGIN…COMMIT et des gros lots d’écriture.
 */
export function withDbExclusive(fn) {
  const runExclusive = exclusiveChain.then(() => fn());
  exclusiveChain = runExclusive.then(
    () => undefined,
    () => undefined
  );
  return runExclusive;
}

/**
 * Ferme proprement la base de données
 */
export function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Méthodes utilitaires encapsulées
export function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export default db;
