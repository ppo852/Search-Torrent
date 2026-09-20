/**
 * Handlers pour les recherches Prowlarr centralisées
 */

import fetch from 'node-fetch';
import prowlarrSearchService, {
  splitQueryTitleAndYear,
} from '../../services/prowlarr/search.js';
import { getSetting, resolveMinSeeds } from '../../services/settings/index.js';
import { getResultCompatibility } from '../../services/utils/validation.js';
import { loadAssignedQualityProfile } from '../../services/utils/helpers.js';

/**
 * Test connexion Prowlarr (admin). Accepte url/api_key en body pour tester avant sauvegarde.
 */
export async function testProwlarrHandler(req, res) {
  try {
    const body = req.body || {};
    let url = typeof body.url === 'string' ? body.url.trim() : '';
    let apiKey =
      typeof body.api_key === 'string'
        ? body.api_key.trim()
        : typeof body.apiKey === 'string'
          ? body.apiKey.trim()
          : '';

    if (!url) url = String((await getSetting('prowlarr_url')) || '').trim();
    if (!apiKey) apiKey = String((await getSetting('prowlarr_api_key')) || '').trim();

    if (!url || !apiKey) {
      return res.status(400).json({ success: false, error: 'Prowlarr non configuré' });
    }

    const base = url.replace(/\/$/, '');
    const response = await fetch(`${base}/api/v1/system/status`, {
      headers: { 'X-Api-Key': apiKey },
      timeout: 8000,
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: `HTTP ${response.status}`,
      });
    }

    const data = await response.json().catch(() => ({}));
    return res.json({
      success: true,
      version: data?.version || null,
      appName: data?.appName || data?.instanceName || 'Prowlarr',
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : 'Échec de connexion Prowlarr',
    });
  }
}

async function withInteractiveProfileCompatibility(results, mediaType) {
  const profiles = await getSetting('quality_profiles');
  const assignments = await getSetting('quality_profile_assignments');
  const profile = loadAssignedQualityProfile(mediaType || 'tv', profiles, assignments);

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
    const { title, year, tmdbId, mediaType, expandTextSearch } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Titre requis' });
    }

    const minSeeds = await resolveMinSeeds();

    const results = await prowlarrSearchService.searchMovie({
      title,
      year: year || '',
      tmdbId: tmdbId || null,
      mediaType: mediaType === 'animation' ? 'animation' : 'movie',
      minSeeds,
      expandTextSearch: expandTextSearch === true,
    });

    const profileType = mediaType === 'animation' ? 'animation' : 'movie';
    res.json({ results: await withInteractiveProfileCompatibility(results, profileType) });
  } catch (error) {
    console.error('Erreur recherche film:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
}

/**
 * Recherche une série TV ou anime (recherche générale, pas un épisode spécifique)
 */
export async function searchTvSeriesHandler(req, res) {
  try {
    const { title, mediaType, tmdbId, year, expandTextSearch } = req.body;

    const minSeeds = await resolveMinSeeds();

    const results = await prowlarrSearchService.searchTvSeries({
      title,
      year: year || '',
      tmdbId: tmdbId || null,
      mediaType: mediaType || 'tv',
      minSeeds,
      expandTextSearch: expandTextSearch === true,
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

    const minSeeds = await resolveMinSeeds();

    // For movies / animation films, use the movie search with relevance filtering
    if (category === 'movies' || category === 'animation') {
      const { title, year } = splitQueryTitleAndYear(query);

      const results = await prowlarrSearchService.searchMovie({
        title,
        year,
        tmdbId: null,
        mediaType: category === 'animation' ? 'animation' : 'movie',
        minSeeds,
      });

      return res.json({
        results: await withInteractiveProfileCompatibility(
          results,
          category === 'animation' ? 'animation' : 'movie'
        ),
      });
    }

    // For TV/anime, use series search
    if (category === 'tv' || category === 'anime') {
      const { title, year } = splitQueryTitleAndYear(query);

      const results = await prowlarrSearchService.searchTvSeries({
        title,
        year,
        mediaType: category,
        minSeeds
      });

      return res.json({
        results: await withInteractiveProfileCompatibility(results, category),
      });
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
