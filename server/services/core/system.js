import fs from 'fs';
import os from 'os';
import path from 'path';
import { getAllUsers } from '../users/index.js';

/**
 * Sur Windows, un chemin "D:\media" reste intact.
 * Multi-chemins Linux "a:b:c" : séparés par ":".
 */
function expandSettingPaths(val) {
  if (typeof val !== 'string' || !val.trim()) return [];
  const raw = val.trim();
  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\')) {
    return [raw];
  }
  return raw.split(':').map((p) => p.trim()).filter(Boolean);
}

function pushUnique(list, value) {
  if (!value || list.includes(value)) return;
  list.push(value);
}

/**
 * Espace disque du volume qui contient les médias (statfs = volume entier).
 * Priorité :
 * 1. download_path_* des users
 * 2. DISK_SPACE_PATH (env, ex. /downloads en stack Docker)
 * 3. /downloads s'il existe
 * 4. cwd → homedir → /media → racine
 */
export async function getDiskSpace() {
  try {
    const pathsToTry = [];

    try {
      const users = await getAllUsers();
      for (const u of users || []) {
        for (const key of [
          'download_path_movies',
          'download_path_series',
          'download_path_anime',
          'download_path_animation',
        ]) {
          for (const p of expandSettingPaths(u[key])) {
            pushUnique(pathsToTry, p);
          }
        }
      }
    } catch {
      // ignore — fallbacks ci-dessous
    }

    const envPath = typeof process.env.DISK_SPACE_PATH === 'string'
      ? process.env.DISK_SPACE_PATH.trim()
      : '';
    if (envPath) {
      pushUnique(pathsToTry, envPath);
    }

    pushUnique(pathsToTry, '/downloads');
    pushUnique(pathsToTry, process.cwd());
    pushUnique(pathsToTry, os.homedir());
    pushUnique(pathsToTry, '/media');

    if (process.platform === 'win32') {
      const drive = (process.env.SystemDrive || 'C:').replace(/\\$/, '');
      pushUnique(pathsToTry, `${drive}\\`);
    } else {
      pushUnique(pathsToTry, '/');
    }

    let pathToCheck = null;
    for (const p of pathsToTry) {
      if (!p) continue;
      try {
        if (fs.existsSync(p)) {
          pathToCheck = p;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!pathToCheck) {
      pathToCheck = process.platform === 'win32' ? `${process.env.SystemDrive || 'C:'}\\` : '/';
    }

    pathToCheck = path.resolve(pathToCheck);

    const stats = fs.statfsSync(pathToCheck);

    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bavail;
    const used = total - free;
    const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;

    return {
      total,
      free,
      used,
      percentUsed,
      label: pathToCheck,
    };
  } catch (err) {
    console.error('[System] Erreur lecture espace disque:', err);
    return null;
  }
}

export default {
  getDiskSpace,
};
