/**
 * Verrou exclusif pour les tâches qui écrivent l'inventaire SQLite
 * (scan disque + sync Emby) — une seule à la fois.
 */

export const INVENTORY_JOB_DISK_SCAN = 'disk-scan';
export const INVENTORY_JOB_EMBY_SYNC = 'emby-sync';

const LABELS = {
  [INVENTORY_JOB_DISK_SCAN]: 'scan disque',
  [INVENTORY_JOB_EMBY_SYNC]: 'sync Emby',
};

let current = null; // { kind, startedAt } | null

export function getInventoryJobLock() {
  if (!current) return null;
  return {
    kind: current.kind,
    label: LABELS[current.kind] || current.kind,
    startedAt: current.startedAt,
  };
}

export function isInventoryJobBusy() {
  return current != null;
}

/**
 * Prend le verrou ou lève une erreur 409 avec message FR.
 * @param {string} kind
 */
export function tryAcquireInventoryJob(kind) {
  if (current) {
    const label = LABELS[current.kind] || current.kind;
    const err = new Error(
      `Une tâche est déjà en cours (${label}). Réessaie plus tard.`
    );
    err.status = 409;
    err.code = 'INVENTORY_JOB_BUSY';
    err.busyKind = current.kind;
    console.log(`[inventory-lock] REFUS ${kind} — déjà occupé par ${current.kind}`);
    throw err;
  }
  current = { kind, startedAt: Date.now() };
  console.log(`[inventory-lock] ACQUIS ${kind}`);
}

/**
 * Libère le verrou uniquement si le kind correspond (évite un release croisé).
 * @param {string} kind
 */
export function releaseInventoryJob(kind) {
  if (current?.kind === kind) {
    current = null;
    console.log(`[inventory-lock] LIBÉRÉ ${kind}`);
  }
}

export default {
  INVENTORY_JOB_DISK_SCAN,
  INVENTORY_JOB_EMBY_SYNC,
  getInventoryJobLock,
  isInventoryJobBusy,
  tryAcquireInventoryJob,
  releaseInventoryJob,
};
