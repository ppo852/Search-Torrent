import qBittorrentService from '../qbittorrent/index.js';
import logger from '../core/logger.js';

export function parseQbitTags(torrent) {
  return String(torrent?.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
}

export function getRequestTag(requestId) {
  return `st:req:${String(requestId)}`;
}

export function buildQbitTagsString({ requestId, seasonNumber, episodeNumber }) {
  const tags = ['st', getRequestTag(requestId)];
  if (Number.isFinite(Number(seasonNumber))) tags.push(`st:s:${String(seasonNumber)}`);
  if (Number.isFinite(Number(episodeNumber))) tags.push(`st:e:${String(episodeNumber)}`);
  return tags.join(',');
}

export function findQbitTorrentByTags(torrents, { requestId, episodeNumber }) {
  const reqTag = getRequestTag(requestId);
  const epTag = Number.isFinite(Number(episodeNumber)) ? `st:e:${String(episodeNumber)}` : null;

  for (const torrent of torrents || []) {
    const tags = parseQbitTags(torrent);
    if (!tags.includes(reqTag)) continue;

    if (epTag) {
      if (tags.includes(epTag)) return torrent;
      continue;
    }

    if (!tags.some((tag) => tag.startsWith('st:e:'))) return torrent;
  }

  return null;
}

export function isEpisodeTorrentInQbit(torrents, { requestId, episodeNumber, torrentName }) {
  const byEpisodeTag = findQbitTorrentByTags(torrents, { requestId, episodeNumber });
  if (byEpisodeTag) return true;

  const packTorrent = findQbitTorrentByTags(torrents, { requestId, episodeNumber: null });
  if (!packTorrent) return false;

  const name = String(torrentName || '').trim();
  if (!name) return true;

  return String(packTorrent.name || '').trim() === name;
}

export async function loadQbitTorrentsForUser(userId) {
  try {
    const { qbitUrl, cookies } = await qBittorrentService.getAuthenticatedQbitConfig(userId);
    return await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/info`, {
      headers: {
        Cookie: cookies,
        Referer: qbitUrl
      }
    });
  } catch (err) {
    logger.warn('qbit-tags', `Lecture qBit impossible pour user ${userId}:`, err?.message || err);
    return null;
  }
}
