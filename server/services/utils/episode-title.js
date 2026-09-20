import { pad2 } from './helpers.js';

/**
 * Détecte un épisode précis dans le nom d'un torrent.
 * Formats reconnus : S01E05, 1x05, 01x05 (pas S1E5).
 */
export function isEpisodeTorrentTitle(title, seasonNumber, episodeNumber) {
  const season = Number(seasonNumber);
  const episode = Number(episodeNumber);
  if (!Number.isFinite(season) || !Number.isFinite(episode) || season <= 0 || episode <= 0) {
    return false;
  }

  const name = String(title || '');
  const seasonPad = pad2(season);
  const episodePad = pad2(episode);

  if (new RegExp(`S${seasonPad}E${episodePad}`, 'i').test(name)) {
    return true;
  }

  const seasonStr = String(season);
  const nxPatterns = [
    new RegExp(`(?:^|[^0-9])${seasonStr}x${episodePad}(?:[^0-9]|$)`, 'i'),
    new RegExp(`(?:^|[^0-9])${seasonPad}x${episodePad}(?:[^0-9]|$)`, 'i'),
  ];
  return nxPatterns.some((re) => re.test(name));
}
