import { readdir, stat } from 'fs/promises';
import path from 'path';
import { upsertMany, deleteMissingPaths, getAllRecordsByPath } from './store.js';
import { 
  normalizeTitleForDb, 
  parseTorrentSafe, 
  cleanMediaTitle, 
  matchTmdbIdFromHistory 
} from './utils.js';

const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v']);

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function isVideoFilePath(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

function splitRoots(pathString) {
  return String(pathString || '').split(':').map((p) => p.trim()).filter(Boolean);
}

function findRootForFile(normPath, roots) {
  for (const root of roots) {
    const r = normalizePath(root).replace(/\/$/, '');
    if (normPath === r || normPath.startsWith(`${r}/`)) {
      return r;
    }
  }
  return null;
}

/**
 * Shared logic to extract year from a string (folder or file)
 */
function extractYear(text) {
  const m = String(text || '').match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Recursively find all video files in a path
 */
async function walkFiles(rootPath) {
  const results = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err) { 
      console.error(`[media-inventory] Error reading ${current}:`, err.code === 'ENOENT' ? 'Folder not found' : err.message);
      continue; 
    }

    for (const ent of entries) {
      const abs = path.join(current, ent.name);
      if (ent.isDirectory()) {
        stack.push(abs);
      } else if (ent.isFile() || ent.isSymbolicLink()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(ext)) continue;
        try {
          const st = await stat(abs);
          results.push({ path: abs, size: st.size, mtimeMs: st.mtimeMs });
        } catch { /* ignore */ }
      }
    }
  }
  return results;
}

async function buildMovieRecord(filePath, fileInfo, moviesRoot) {
  const rel = path.relative(moviesRoot, filePath);
  const folder = rel.split(path.sep)[0] || '';
  const baseName = path.basename(filePath, path.extname(filePath));

  // 1. Cleaning and Year detection
  let year = extractYear(folder) || extractYear(baseName);
  let titleSource = folder || baseName;
  let title = cleanMediaTitle(titleSource);

  // 2. Refine with PTN if needed
  try {
    const parsed = await parseTorrentSafe(titleSource);
    if (parsed?.ok) {
      if (parsed.title) title = parsed.title;
      if (parsed.year && !year) year = parsed.year;
    }
  } catch { /* ignore */ }

  // 3. Link with History (Anti-duplicate)
  const tmdb_id = await matchTmdbIdFromHistory(filePath, 'movie');

  return {
    media_kind: 'movie',
    title,
    title_normalized: normalizeTitleForDb(title),
    tmdb_id,
    year,
    season: null,
    episode: null,
    path: filePath.replace(/\\/g, '/'),
    size: fileInfo.size,
    mtime_ms: Math.floor(fileInfo.mtimeMs)
  };
}

async function buildTvRecord(filePath, fileInfo, seriesRoot) {
  const rel = path.relative(seriesRoot, filePath);
  const parts = rel.split(path.sep).filter(Boolean);
  const showFolder = parts[0] || '';
  const baseName = path.basename(filePath, path.extname(filePath));

  // 1. Title and Year
  let year = extractYear(showFolder);
  let title = cleanMediaTitle(showFolder || baseName);

  // 2. Parse Season/Episode with PTN
  let season = null;
  let episode = null;
  try {
    const parsed = await parseTorrentSafe(baseName);
    if (parsed?.ok) {
      season = parsed.season;
      episode = parsed.episode;
      if (parsed.year && !year) year = parsed.year;
    }
    if (season == null) {
      const parsedFolder = await parseTorrentSafe(showFolder);
      if (parsedFolder?.ok) {
        season = parsedFolder.season;
        if (parsedFolder.year && !year) year = parsedFolder.year;
      }
    }
  } catch { /* ignore */ }

  // 3. Link with History
  const tmdb_id = await matchTmdbIdFromHistory(filePath, 'tv');

  return {
    media_kind: 'tv',
    title,
    title_normalized: normalizeTitleForDb(title),
    tmdb_id,
    year,
    season,
    episode,
    path: filePath.replace(/\\/g, '/'),
    size: fileInfo.size,
    mtime_ms: Math.floor(fileInfo.mtimeMs)
  };
}

/**
 * Generic scan worker for a list of roots
 */
async function scanRoots(roots, kind, existingMap) {
  const results = [];
  const keep = [];
  
  for (const root of roots) {
    const files = await walkFiles(root);
    let prepared = 0, skipped = 0;

    for (const f of files) {
      const normPath = f.path.replace(/\\/g, '/');
      const existing = existingMap.get(normPath);
      const mtime = Math.floor(f.mtimeMs);

      if (existing && existing.mtime_ms === mtime && existing.size === f.size) {
        results.push({ ...existing, last_seen_at: new Date().toISOString() });
        keep.push(normPath);
        skipped++;
        continue;
      }

      const record = (kind === 'movie') 
        ? await buildMovieRecord(f.path, f, root)
        : await buildTvRecord(f.path, f, root);

      if (record && record.title_normalized) {
        results.push(record);
        keep.push(record.path);
        prepared++;
      }
    }
    console.log(`[media-inventory] ${kind} scan on ${root}: ${prepared} new, ${skipped} skipped`);
  }
  return { results, keep };
}

/**
 * Ingest a single video file without scanning entire library trees.
 */
export async function ingestSingleFile(filePath, { moviesPath, seriesPath, animePath }) {
  if (!isVideoFilePath(filePath)) return null;

  const normPath = normalizePath(filePath);
  const moviesRoots = splitRoots(moviesPath);
  const seriesRoots = splitRoots(seriesPath);
  const animeRoots = splitRoots(animePath);

  let root = findRootForFile(normPath, moviesRoots);
  let kind = 'movie';

  if (!root) {
    root = findRootForFile(normPath, seriesRoots);
    kind = 'tv';
  }
  if (!root) {
    root = findRootForFile(normPath, animeRoots);
    kind = 'tv';
  }
  if (!root) return null;

  let st;
  try {
    st = await stat(filePath);
  } catch {
    return null;
  }

  const fileInfo = { path: filePath, size: st.size, mtimeMs: st.mtimeMs };
  const record = kind === 'movie'
    ? await buildMovieRecord(filePath, fileInfo, root)
    : await buildTvRecord(filePath, fileInfo, root);

  if (!record?.title_normalized) return null;

  await upsertMany([record]);
  return record;
}

export async function scanAndSync({ moviesPath, seriesPath, animePath }) {
  try {
    const moviesRoots = String(moviesPath || '').split(':').map(p => p.trim()).filter(Boolean);
    const seriesRoots = String(seriesPath || '').split(':').map(p => p.trim()).filter(Boolean);
    const animeRoots = String(animePath || '').split(':').map(p => p.trim()).filter(Boolean);

    const existingRecordsMap = await getAllRecordsByPath();
    
    const moviesData = await scanRoots(moviesRoots, 'movie', existingRecordsMap);
    const seriesData = await scanRoots(seriesRoots, 'tv', existingRecordsMap);
    const animeData = await scanRoots(animeRoots, 'tv', existingRecordsMap);

    const allItems = [...moviesData.results, ...seriesData.results, ...animeData.results];
    const allKeep = [...moviesData.keep, ...seriesData.keep, ...animeData.keep];

    await upsertMany(allItems);
    await deleteMissingPaths(allKeep);

    return {
      scanned: allItems.length,
      movies_paths: moviesRoots,
      series_paths: seriesRoots,
      anime_paths: animeRoots
    };
  } catch (err) {
    console.error('[media-inventory] Scan error:', err);
    throw err;
  }
}

export default { scanAndSync, ingestSingleFile };

