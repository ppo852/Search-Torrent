import embyService from '../../services/emby/index.js';

function resolveOverrides(body = {}) {
  const overrides = {};
  if (typeof body.url === 'string') overrides.url = body.url;
  if (typeof body.api_key === 'string') overrides.apiKey = body.api_key;
  if (typeof body.apiKey === 'string') overrides.apiKey = body.apiKey;
  return overrides;
}

export async function testEmbyHandler(req, res) {
  try {
    const result = await embyService.testConnection(resolveOverrides(req.body || {}));
    res.json(result);
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 502;
    res.status(status >= 400 && status < 600 ? status : 502).json({
      success: false,
      error: error instanceof Error ? error.message : 'Échec de connexion Emby',
    });
  }
}

export async function listEmbyLibrariesHandler(req, res) {
  try {
    const overrides = {};
    if (typeof req.query.url === 'string') overrides.url = req.query.url;
    if (typeof req.query.api_key === 'string') overrides.apiKey = req.query.api_key;

    const libraries = await embyService.listLibraries(overrides);
    const status = await embyService.getEmbyStatus();
    res.json({
      success: true,
      libraries,
      selectedLibraryIds: status.libraryIds,
    });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 502;
    res.status(status >= 400 && status < 600 ? status : 502).json({
      success: false,
      error: error instanceof Error ? error.message : 'Impossible de lister les bibliothèques Emby',
    });
  }
}

export async function getEmbyStatusHandler(req, res) {
  try {
    const status = await embyService.getEmbyStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur statut Emby',
    });
  }
}

export async function syncEmbyNowHandler(req, res) {
  try {
    const status = embyService.startSyncJob();
    res.json({ success: true, started: true, status });
  } catch (error) {
    const code = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(code >= 400 && code < 600 ? code : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Impossible de lancer le sync Emby',
    });
  }
}
