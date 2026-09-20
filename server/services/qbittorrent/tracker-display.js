const TRACKER_CACHE_TTL_MS = 60_000;

/** @type {Map<string, { expiresAt: number, map: Map<string, string> }>} */
const stableTrackerCacheByKey = new Map();

/** @type {Map<string, Promise<Map<string, string>>>} */
const stableTrackerRefreshByKey = new Map();

/**
 * Choisit une URL de tracker stable pour l'UI (comme la liste qBit),
 * pas le champ "tracker courant" qui peut basculer à la pause.
 *
 * @param {Array<{ url?: string, tier?: number, status?: number }>|null|undefined} trackers
 * @param {string} [fallback]
 * @returns {string}
 */
export function pickStableTrackerUrl(trackers, fallback = '') {
  if (!Array.isArray(trackers) || trackers.length === 0) {
    return fallback || '';
  }

  const real = trackers.filter((t) => {
    const url = String(t?.url || '');
    // DHT / PeX / LSD dans l'API qBit
    return url.length > 0 && !url.startsWith('**');
  });

  if (real.length === 0) return fallback || '';

  real.sort((a, b) => Number(a.tier ?? 0) - Number(b.tier ?? 0));
  const minTier = Number(real[0].tier ?? 0);
  const sameTier = real.filter((t) => Number(t.tier ?? 0) === minTier);
  // status 2 = Working (doc API qBit)
  const working = sameTier.find((t) => Number(t.status) === 2);
  return String((working || sameTier[0])?.url || fallback || '');
}

/**
 * Remplace torrent.tracker par une URL issue de la liste trackers, puis retire trackers du payload.
 * @param {any[]} torrents
 * @returns {any[]}
 */
export function applyStableTrackers(torrents) {
  if (!Array.isArray(torrents)) return torrents;
  return torrents.map((t) => {
    const stable = pickStableTrackerUrl(t.trackers, t.tracker);
    const { trackers: _trackers, ...rest } = t;
    return {
      ...rest,
      tracker: stable || t.tracker || '',
    };
  });
}

/**
 * @param {any[]} torrents
 * @returns {Map<string, string>}
 */
function buildStableTrackerMap(torrents) {
  const map = new Map();
  for (const t of applyStableTrackers(Array.isArray(torrents) ? torrents : [])) {
    const hash = String(t.hash || '').toLowerCase();
    if (hash) map.set(hash, t.tracker || '');
  }
  return map;
}

/**
 * Cache hash → tracker stable (TTL 60 s). Les polls maindata réutilisent le cache.
 * @param {string} cacheKey
 * @param {() => Promise<any[]>} fetchTorrentsWithTrackers
 * @returns {Promise<Map<string, string>|null>}
 */
export async function getStableTrackerMap(cacheKey, fetchTorrentsWithTrackers) {
  const now = Date.now();
  const cached = stableTrackerCacheByKey.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.map;
  }

  let pending = stableTrackerRefreshByKey.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const info = await fetchTorrentsWithTrackers();
        const map = buildStableTrackerMap(info);
        stableTrackerCacheByKey.set(cacheKey, {
          map,
          expiresAt: Date.now() + TRACKER_CACHE_TTL_MS,
        });
        return map;
      } finally {
        stableTrackerRefreshByKey.delete(cacheKey);
      }
    })();
    stableTrackerRefreshByKey.set(cacheKey, pending);
  }

  try {
    return await pending;
  } catch {
    return cached?.map ?? null;
  }
}

/**
 * Applique les trackers stables aux torrents d'une réponse maindata.
 * @param {any} data
 * @param {Map<string, string>|null|undefined} stableByHash
 */
export function applyStableTrackersToMaindata(data, stableByHash) {
  if (!stableByHash || !data?.torrents || typeof data.torrents !== 'object') return;
  for (const [hash, torrent] of Object.entries(data.torrents)) {
    const stable = stableByHash.get(String(hash).toLowerCase());
    if (stable && torrent && typeof torrent === 'object') {
      torrent.tracker = stable;
    }
  }
}
