<<<<<<< HEAD
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
=======
import { readdir, stat, lstat } from 'fs/promises';
import path from 'path';
import { upsertMany, deleteMissingPaths } from './store.js';
import { normalizeTitleForDb, parseTorrentSafe } from './utils.js';

const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v']);

function normalizeTitle(value) {
  return normalizeTitleForDb(value);
}

function parseYearFromFolder(folderName) {
  const m = String(folderName || '').match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isInteger(y)) return null;
  if (y < 1900 || y > 2100) return null;
  return y;
}

function parseSeasonFromFolder(folderName) {
  const t = String(folderName || '');
  const m = t.match(/\b(?:season|saison)\s*(\d{1,2})\b/i) || t.match(/\bS(\d{1,2})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) ? n : null;
}

function parseEpisodeFromFilename(filename) {
  const t = String(filename || '');
  let m = t.match(/\bS(\d{1,2})E(\d{1,2})\b/i);
  if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  m = t.match(/\b(\d{1,2})x(\d{1,2})\b/i);
  if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  return null;
}

async function walkFiles(rootPath) {
  const results = [];

  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    }

    for (const ent of entries) {
      const abs = path.join(current, ent.name);
<<<<<<< HEAD
      if (ent.isDirectory()) {
        stack.push(abs);
      } else if (ent.isFile() || ent.isSymbolicLink()) {
=======

      if (ent.isDirectory()) {
        stack.push(abs);
        continue;
      }

      if (ent.isSymbolicLink()) {
        // Follow symlink.
        try {
          const st = await stat(abs);
          if (st.isDirectory()) {
            stack.push(abs);
            continue;
          }
          if (st.isFile()) {
            results.push({ path: abs, size: st.size, mtimeMs: st.mtimeMs });
          }
        } catch {
          // ignore broken links
        }
        continue;
      }

      if (ent.isFile()) {
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
        const ext = path.extname(ent.name).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(ext)) continue;
        try {
          const st = await stat(abs);
          results.push({ path: abs, size: st.size, mtimeMs: st.mtimeMs });
<<<<<<< HEAD
        } catch { /* ignore */ }
      }
    }
  }
=======
        } catch {
          // ignore
        }
      }
    }
  }

>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  return results;
}

async function buildMovieRecord(filePath, fileInfo, moviesRoot) {
  const rel = path.relative(moviesRoot, filePath);
<<<<<<< HEAD
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
=======
  const parts = rel.split(path.sep).filter(Boolean);
  const folder = parts[0] || '';

  // Try to get year from folder; fallback to filename if not found
  let year = parseYearFromFolder(folder);
  const baseNameNoExt = path.basename(filePath, path.extname(filePath));
  if (year == null) {
    year = parseYearFromFolder(baseNameNoExt);
  }

  // Build title source: prefer folder name; else filename without extension
  let titleSource = folder || baseNameNoExt;

  // Prefer parse-torrent-name on folder then filename
  try {
    const targets = [folder, baseNameNoExt].filter(Boolean);
    for (const t of targets) {
      // eslint-disable-next-line no-await-in-loop
      const parsed = await parseTorrentSafe(t);
      if (parsed?.ok && parsed.title) {
        titleSource = parsed.title;
        if (parsed.year && (year == null)) year = parsed.year;
        break;
      }
    }
  } catch {
    // ignore
  }
  // If year appears in filename, cut at year to drop tags after
  if (!folder && year != null) {
    const m = String(baseNameNoExt).match(/\b(19\d{2}|20\d{2})\b/);
    if (m && m.index != null) {
      titleSource = baseNameNoExt.slice(0, m.index);
    }
  }
  // Replace common separators with spaces early
  titleSource = titleSource.replace(/[._]+/g, ' ');

  const title = titleSource
    .replace(/\b(19\d{2}|20\d{2})\b/g, '')
    .replace(/[()]/g, '')
    .trim();
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

  return {
    media_kind: 'movie',
    title,
<<<<<<< HEAD
    title_normalized: normalizeTitleForDb(title),
    tmdb_id,
=======
    title_normalized: normalizeTitle(title),
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
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
<<<<<<< HEAD
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
=======
  const seasonFolder = parts[1] || '';

  let year = parseYearFromFolder(showFolder);
  let title = showFolder ? showFolder.replace(/\b(19\d{2}|20\d{2})\b/g, '').replace(/[()]/g, '').trim() : showFolder;

  // Try parse-torrent-name on folder and filename
  // Priority: filename first (has episode info), then folder (for title)
  let season = null;
  let episode = null;
  const filename = path.basename(filePath);
  
  try {
    // First try filename - it usually has S01E01 info
    const parsedFile = await parseTorrentSafe(filename);
    if (parsedFile?.ok) {
      if (Number.isInteger(parsedFile.season)) season = parsedFile.season;
      if (Number.isInteger(parsedFile.episode)) episode = parsedFile.episode;
      if (parsedFile.title) title = parsedFile.title;
      if (parsedFile.year && (year == null)) year = parsedFile.year;
    }
    
    // If no season/episode from filename, try folder
    if (season == null || episode == null) {
      const parsedFolder = await parseTorrentSafe(showFolder);
      if (parsedFolder?.ok) {
        if (parsedFolder.title && !title) title = parsedFolder.title;
        if (parsedFolder.year && (year == null)) year = parsedFolder.year;
        if (season == null && Number.isInteger(parsedFolder.season)) season = parsedFolder.season;
        if (episode == null && Number.isInteger(parsedFolder.episode)) episode = parsedFolder.episode;
      }
    }
  } catch {
    // ignore
  }

  // Fallbacks from folder/filename patterns
  const seasonFromFolder = parseSeasonFromFolder(seasonFolder);
  const epParsed = parseEpisodeFromFilename(path.basename(filePath));
  if (season == null) season = seasonFromFolder ?? epParsed?.season ?? null;
  if (episode == null) episode = epParsed?.episode ?? null;

  return {
    media_kind: 'tv',
    title: title || showFolder,
    title_normalized: normalizeTitle(title || showFolder),
    year,
    season: Number.isInteger(season) ? season : null,
    episode: Number.isInteger(episode) ? episode : null,
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    path: filePath.replace(/\\/g, '/'),
    size: fileInfo.size,
    mtime_ms: Math.floor(fileInfo.mtimeMs)
  };
}

<<<<<<< HEAD
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
=======
export async function scanAndSync({ moviesPath, seriesPath }) {
  const moviesRoots = String(moviesPath || '').split(':').map(p => p.trim()).filter(Boolean);
  const seriesRoots = String(seriesPath || '').split(':').map(p => p.trim()).filter(Boolean);

  console.log('[media-inventory] Scan start', { moviesRoots, seriesRoots });

  const items = [];
  const keepPaths = [];

  try {
    for (const moviesRoot of moviesRoots) {
      const files = await walkFiles(moviesRoot);
      console.log('[media-inventory] Movies files found', { root: moviesRoot, count: files.length });
      let prepared = 0;
      for (const f of files) {
        const ext = path.extname(f.path).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(ext)) continue;
        const record = await buildMovieRecord(f.path, f, moviesRoot);
        if (!record || !record.title_normalized) continue;
        items.push(record);
        keepPaths.push(record.path);
        prepared++;
      }
      console.log('[media-inventory] Movies items prepared', { root: moviesRoot, count: prepared });
    }

    for (const seriesRoot of seriesRoots) {
      const files = await walkFiles(seriesRoot);
      console.log('[media-inventory] Series files found', { root: seriesRoot, count: files.length });
      let prepared = 0;
      for (const f of files) {
        const ext = path.extname(f.path).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(ext)) continue;
        const record = await buildTvRecord(f.path, f, seriesRoot);
        if (!record || !record.title_normalized) continue;
        items.push(record);
        keepPaths.push(record.path);
        prepared++;
      }
      console.log('[media-inventory] Series items prepared', { root: seriesRoot, count: prepared });
    }

    await upsertMany(items);
    console.log('[media-inventory] Upserted items', { count: items.length });

    // Purge stale entries not seen in this scan (only under /media/*)
    try {
      await deleteMissingPaths(keepPaths);
      console.log('[media-inventory] Purge done', { kept: keepPaths.length });
    } catch (err) {
      console.error('[media-inventory] Purge error', err);
    }

    const summary = {
      scanned: items.length,
      movies_paths: moviesRoots,
      series_paths: seriesRoots
    };
    console.log('[media-inventory] Scan done', summary);
    return summary;
  } catch (err) {
    console.error('[media-inventory] Scan error', err);
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    throw err;
  }
}

<<<<<<< HEAD
export default { scanAndSync, ingestSingleFile };

=======
export default {
  scanAndSync
};
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
