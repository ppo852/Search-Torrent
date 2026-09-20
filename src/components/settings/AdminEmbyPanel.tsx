import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, HardDrive, RefreshCw, Server } from 'lucide-react';
import { api } from '../../services/api';
import { showErrorToast, showInfoToast, showToast } from '../../stores/toastStore';

interface EmbyLibrary {
  id: string;
  name: string;
  collectionType: string | null;
  locations: string[];
}

interface EmbyStatusInfo {
  itemCount: number;
  syncRunning: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastResult?: {
    movies?: number;
    episodes?: number;
    deleted?: number;
  } | null;
}

interface EmbyConfigState {
  url: string;
  apiKey: string;
  libraryIds: string[];
}

async function loadEmbyConfig(): Promise<EmbyConfigState> {
  const settings = await api.getSettings();
  return {
    url: settings.emby_url || '',
    apiKey: settings.emby_api_key || '',
    libraryIds: Array.isArray(settings.emby_library_ids)
      ? settings.emby_library_ids.map(String)
      : [],
  };
}

function isEmbyConfigured(config: EmbyConfigState) {
  return Boolean(config.url.trim() && config.apiKey.trim() && config.libraryIds.length > 0);
}

/** Connexion Emby + choix des bibliothèques (onglet Intégrations). */
export function AdminEmbyConnectionPanel() {
  const [embyUrl, setEmbyUrl] = useState('');
  const [embyApiKey, setEmbyApiKey] = useState('');
  const [libraries, setLibraries] = useState<EmbyLibrary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [serverLabel, setServerLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const config = await loadEmbyConfig();
      setEmbyUrl(config.url);
      setEmbyApiKey(config.apiKey);
      setSelectedIds(config.libraryIds);

      if (config.url && config.apiKey) {
        try {
          const data = await api.getEmbyLibraries();
          setLibraries(data.libraries || []);
        } catch {
          setLibraries([]);
        }
      }
    } catch {
      showErrorToast('Impossible de charger la config Emby');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setServerLabel(null);
      const result = await api.testEmbyConnection({
        url: embyUrl,
        api_key: embyApiKey,
      });
      const label = [result.serverName, result.version].filter(Boolean).join(' · ');
      setServerLabel(label || 'Connexion OK');
      showToast('Connexion Emby réussie');
    } catch (err: any) {
      setServerLabel(null);
      showErrorToast(err?.message || 'Échec de connexion Emby');
    } finally {
      setIsTesting(false);
    }
  };

  const handleLoadLibraries = async () => {
    try {
      setIsLoadingLibraries(true);
      const data = await api.getEmbyLibraries({
        url: embyUrl.trim(),
        api_key: embyApiKey.trim(),
      });
      setLibraries(data.libraries || []);
      if ((data.libraries || []).length === 0) {
        showInfoToast('Aucune bibliothèque Emby trouvée');
      } else {
        showToast(`${data.libraries.length} bibliothèque(s) chargée(s)`);
      }
    } catch (err: any) {
      showErrorToast(err?.message || 'Impossible de lister les bibliothèques');
    } finally {
      setIsLoadingLibraries(false);
    }
  };

  const toggleLibrary = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.updateSettings({
        emby_url: embyUrl.trim(),
        emby_api_key: embyApiKey.trim(),
        emby_library_ids: selectedIds,
      });
      showToast('Connexion Emby enregistrée');
    } catch (err: any) {
      showErrorToast(err?.message || 'Échec de sauvegarde Emby');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest">Chargement Emby…</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex items-center gap-4 border-b border-white/5 pb-4">
        <HardDrive className="text-emerald-500" size={24} />
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Connexion Emby</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-6 border-white/5">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Server className="text-emerald-500" size={20} /> Serveur
          </h3>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">URL Emby</label>
            <input
              type="url"
              value={embyUrl}
              onChange={(e) => setEmbyUrl(e.target.value)}
              placeholder="http://emby:8096"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-emerald-500/40 transition-all outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Clé API</label>
            <input
              type="password"
              value={embyApiKey}
              onChange={(e) => setEmbyApiKey(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-emerald-500/40 transition-all outline-none"
            />
          </div>
          {serverLabel && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle2 size={16} />
              {serverLabel}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !embyUrl.trim() || !embyApiKey.trim()}
              className="px-5 py-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
            >
              <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
              Tester
            </button>
            <button
              type="button"
              onClick={handleLoadLibraries}
              disabled={isLoadingLibraries || !embyUrl.trim() || !embyApiKey.trim()}
              className="px-5 py-3 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
            >
              <HardDrive size={14} className={isLoadingLibraries ? 'animate-spin' : ''} />
              Charger les bibliothèques
            </button>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6 border-white/5">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Bibliothèques à surveiller</h3>
          <p className="text-[11px] text-gray-500 font-medium normal-case tracking-normal">
            Coche les bibliothèques Emby utilisées pour détecter les médias déjà possédés.
          </p>
          {libraries.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
              <p className="text-gray-600 font-black uppercase text-[10px] tracking-widest">
                Aucune bibliothèque — teste la connexion puis charge la liste
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
              {libraries.map((lib) => {
                const checked = selectedIds.includes(lib.id);
                return (
                  <label
                    key={lib.id}
                    className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                      checked
                        ? 'bg-emerald-600/10 border-emerald-500/40'
                        : 'bg-white/5 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLibrary(lib.id)}
                      className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-600"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white uppercase tracking-tighter truncate">{lib.name}</div>
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">
                        {lib.collectionType || 'type inconnu'} · id {lib.id.slice(0, 8)}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-4 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-emerald-600/30 hover:bg-emerald-500 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement…' : 'Sauvegarder la connexion Emby'}
        </button>
      </div>
    </div>
  );
}

/** Sync inventaire Emby (onglet Inventaire & planification). */
export function AdminEmbyInventoryPanel({
  onGoToIntegrations,
  syncInterval,
  onSyncIntervalChange,
}: {
  onGoToIntegrations?: () => void;
  /** Contrôlé par la page admin (sauvegarde unique). */
  syncInterval: string;
  onSyncIntervalChange: (value: string) => void;
}) {
  const [embyConfigured, setEmbyConfigured] = useState(false);
  const [syncStatus, setSyncStatus] = useState<EmbyStatusInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasSyncRunning = useRef(false);

  const refreshStatus = async () => {
    try {
      const status = await api.getEmbyStatus();
      setSyncStatus({
        itemCount: status.itemCount || 0,
        syncRunning: Boolean(status.syncRunning),
        lastSyncAt: status.lastSyncAt || null,
        lastSyncError: status.lastSyncError || null,
        lastResult: status.lastResult || null,
      });
      return status;
    } catch {
      return null;
    }
  };

  const load = async () => {
    try {
      setIsLoading(true);
      const config = await loadEmbyConfig();
      setEmbyConfigured(isEmbyConfigured(config));
      await refreshStatus();
      try {
        const status = await api.getEmbyStatus();
        if (status?.syncRunning) {
          wasSyncRunning.current = true;
          setIsSyncing(true);
        }
      } catch {
        // ignore
      }
    } catch {
      showErrorToast('Impossible de charger l\'inventaire Emby');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    let cancelled = false;

    const tick = async () => {
      const status = await refreshStatus();
      if (cancelled || !status) return;
      const running = Boolean(status.syncRunning);
      if (wasSyncRunning.current && !running) {
        setIsSyncing(false);
        if (status.lastSyncError) {
          showErrorToast(`Sync Emby terminé avec erreur : ${status.lastSyncError}`);
        } else {
          const n = status.itemCount || 0;
          showToast(`Sync Emby terminé (${n} item${n > 1 ? 's' : ''})`);
        }
      }
      wasSyncRunning.current = running;
      if (!running && interval != null) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };

    if (isSyncing || syncStatus?.syncRunning) {
      tick();
      interval = window.setInterval(tick, 2000);
    }

    return () => {
      cancelled = true;
      if (interval != null) window.clearInterval(interval);
    };
  }, [isSyncing, syncStatus?.syncRunning]);

  const handleSyncNow = async () => {
    try {
      wasSyncRunning.current = true;
      setIsSyncing(true);
      await api.syncEmbyNow();
      showInfoToast('Sync Emby lancé…');
      await refreshStatus();
    } catch (err: any) {
      setIsSyncing(false);
      wasSyncRunning.current = false;
      showErrorToast(err?.message || 'Impossible de lancer le sync Emby');
    }
  };

  const syncBusy = isSyncing || Boolean(syncStatus?.syncRunning);

  if (isLoading) {
    return (
      <div className="glass-card p-8 border-white/5 flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="glass-card p-8 space-y-6 border-white/5 h-full">
      <div>
        <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
          <HardDrive className="text-emerald-500" size={20} /> Inventaire Emby
        </h3>
        <p className="text-[11px] text-gray-500 mt-2 font-medium normal-case tracking-normal">
          Met à jour la liste des films et épisodes déjà présents dans Emby. Complète le scan disque pour l&apos;anti-doublon.
        </p>
      </div>

      {!embyConfigured && (
        <div className="p-4 rounded-2xl bg-amber-600/10 border border-amber-500/20 space-y-3">
          <p className="text-[11px] text-amber-200/90 font-medium normal-case tracking-normal">
            Emby n&apos;est pas encore configuré (URL, clé API ou bibliothèques manquantes).
          </p>
          {onGoToIntegrations && (
            <button
              type="button"
              onClick={onGoToIntegrations}
              className="text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-white transition-colors"
            >
              Configurer Emby dans Intégrations →
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">
          Intervalle de synchronisation (min)
        </label>
        <input
          type="number"
          min={5}
          value={syncInterval}
          onChange={(e) => onSyncIntervalChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-emerald-500/40 transition-all outline-none"
        />
        <p className="text-[10px] text-gray-600 font-medium normal-case tracking-normal">
          L&apos;intervalle est enregistré avec le bouton « Tout sauvegarder » en bas de page.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <span>
          Items indexés : <span className="text-white">{syncStatus?.itemCount ?? 0}</span>
        </span>
        <span>
          Dernier sync :{' '}
          <span className="text-white">
            {syncStatus?.lastSyncAt
              ? new Date(syncStatus.lastSyncAt).toLocaleString('fr-FR')
              : 'jamais'}
          </span>
        </span>
        {syncStatus?.lastResult && (
          <span>
            Dernier run :{' '}
            <span className="text-white">
              {syncStatus.lastResult.movies ?? 0} films · {syncStatus.lastResult.episodes ?? 0} épisodes
            </span>
          </span>
        )}
        {syncStatus?.lastSyncError && (
          <span className="text-red-400 normal-case">Erreur : {syncStatus.lastSyncError}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncBusy || !embyConfigured}
          className="px-6 py-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
        >
          <RefreshCw size={16} className={syncBusy ? 'animate-spin' : ''} />
          {syncBusy ? 'Sync en cours…' : 'Synchroniser maintenant'}
        </button>
      </div>
    </div>
  );
}
