/**
 * Handlers pour les recherches Prowlarr centralisées
 */

import prowlarrSearchService from '../../services/prowlarr/search.js';
import { getSetting } from '../../services/settings/index.js';
import { getResultCompatibility } from '../../services/utils/validation.js';
import { loadAssignedQualityProfile } from '../../services/utils/helpers.js';

async function withInteractiveProfileCompatibility(results, mediaType) {
  const profiles = await getSetting('quality_profiles');
  const assignments = await getSetting('quality_profile_assignments');
  const profileMediaType = mediaType === 'movie' ? 'movie' : 'tv';
  const profile = loadAssignedQualityProfile(profileMediaType, profiles, assignments);

  return (results || []).map((r) => ({
    ...r,
    ...getResultCompatibility(r, profile, 1, { interactive: true }),
  }));
}

/**
 * Recherche un film avec variantes de titre et filtrage par pertinence
 */
export async function searchMovieHandler(req, res) {
  try {
    const { title, year, tmdbId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Titre requis' });
    }

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    const results = await prowlarrSearchService.searchMovie({
      title,
      year: year || '',
      tmdbId: tmdbId || null,
      minSeeds,
      filterByRelevance: true
    });

    res.json({ results: await withInteractiveProfileCompatibility(results, 'movie') });
  } catch (error) {
    console.error('Erreur recherche film:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
}

/**
 * Recherche un épisode TV
 */
export async function searchTvEpisodeHandler(req, res) {
  try {
    const { title, seasonNumber, episodeNumber, mediaType, tmdbId } = req.body;

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    const results = await prowlarrSearchService.searchTvEpisode({
      title,
      seasonNumber: Number(seasonNumber),
      episodeNumber: Number(episodeNumber),
      tmdbId: tmdbId || null,
      mediaType: mediaType || 'tv',
      minSeeds
    });

    res.json({ results });
  } catch (error) {
    console.error('Erreur recherche TV:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
}

/**
 * Recherche une série TV ou anime (recherche générale, pas un épisode spécifique)
 */
export async function searchTvSeriesHandler(req, res) {
  try {
    const { title, mediaType, tmdbId, year } = req.body;

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    const results = await prowlarrSearchService.searchTvSeries({
      title,
      year: year || '',
      tmdbId: tmdbId || null,
      mediaType: mediaType || 'tv',
      minSeeds
    });

    res.json({ results: await withInteractiveProfileCompatibility(results, mediaType || 'tv') });
  } catch (error) {
    console.error('Erreur recherche série TV:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
}

/**
 * Recherche générale (toutes catégories)
 */
export async function searchGeneralHandler(req, res) {
  try {
    const { query, category } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query requis' });
    }

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    // For movies, use the movie search with relevance filtering
    if (category === 'movies') {
      const yearMatch = query.match(/\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch?.[1] || '';
      const title = query.replace(/\b(19\d{2}|20\d{2})\b/, '').trim();

      const results = await prowlarrSearchService.searchMovie({
        title,
        year,
        tmdbId: null,
        minSeeds,
        filterByRelevance: true
      });

      return res.json({ results });
    }

    // For TV/anime, use series search
    if (category === 'tv' || category === 'anime') {
      const yearMatch = query.match(/\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch?.[1] || '';
      const title = query.replace(/\b(19\d{2}|20\d{2})\b/, '').trim();

      const results = await prowlarrSearchService.searchTvSeries({
        title,
        year,
        mediaType: category,
        minSeeds
      });

      return res.json({ results });
    }

    const results = await prowlarrSearchService.searchGeneral({
      query,
      category: category === 'all' ? null : (category || null),
      minSeeds
    });

    res.json({ results });
  } catch (error) {
    console.error('Erreur recherche générale:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
}
