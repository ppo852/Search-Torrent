/**
 * Handlers pour les recherches Prowlarr centralisées
 */

import prowlarrSearchService from '../../services/prowlarr/search.js';
import { getSetting } from '../../services/settings/index.js';
<<<<<<< HEAD
import { getResultCompatibility } from '../../services/utils/validation.js';
=======
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

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

    res.json({ results });
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
<<<<<<< HEAD
    const { title, seasonNumber, episodeNumber, mediaType, tmdbId } = req.body;
=======
    const { title, seasonNumber, episodeNumber, mediaType } = req.body;

    if (!title || !seasonNumber || !episodeNumber) {
      return res.status(400).json({ error: 'Titre, numéro de saison et épisode requis' });
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    const results = await prowlarrSearchService.searchTvEpisode({
      title,
      seasonNumber: Number(seasonNumber),
      episodeNumber: Number(episodeNumber),
<<<<<<< HEAD
      tmdbId: tmdbId || null,
=======
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
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
<<<<<<< HEAD
    const { title, mediaType, tmdbId, year } = req.body;
=======
    const { title, mediaType, tmdbId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Titre requis' });
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    const results = await prowlarrSearchService.searchTvSeries({
      title,
<<<<<<< HEAD
      year: year || '',
=======
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
      tmdbId: tmdbId || null,
      mediaType: mediaType || 'tv',
      minSeeds
    });

    res.json({ results });
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
<<<<<<< HEAD
      const yearMatch = query.match(/\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch?.[1] || '';
      const title = query.replace(/\b(19\d{2}|20\d{2})\b/, '').trim();

      const results = await prowlarrSearchService.searchTvSeries({
        title,
        year,
=======
      const results = await prowlarrSearchService.searchTvSeries({
        title: query,
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
        mediaType: category,
        minSeeds
      });

      return res.json({ results });
    }

<<<<<<< HEAD
    const results = await prowlarrSearchService.searchGeneral({
      query,
      category: category === 'all' ? null : (category || null),
=======
    // General search (all categories)
    const results = await prowlarrSearchService.searchGeneral({
      query,
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
      minSeeds
    });

    res.json({ results });
  } catch (error) {
    console.error('Erreur recherche générale:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
}
