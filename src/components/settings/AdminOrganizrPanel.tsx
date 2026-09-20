import { useEffect, useState } from 'react';
import { CheckCircle2, LayoutDashboard, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { showErrorToast, showToast } from '../../stores/toastStore';

function isEnabledFlag(value: unknown) {
  return ['1', 'true', 'yes', true, 1].includes(value as any);
}

/** SSO Organizr (API Server Auth) — onglet Intégrations. */
export function AdminOrganizrPanel() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [authGroup, setAuthGroup] = useState('998');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);

  const persist = () =>
    api.updateSettings({
      organizr_sso_enabled: enabled,
      organizr_url: url.trim(),
      organizr_auth_group: (authGroup || '998').trim(),
    });

  const load = async () => {
    try {
      setIsLoading(true);
      const settings = await api.getSettings();
      setEnabled(isEnabledFlag(settings.organizr_sso_enabled));
      setUrl(settings.organizr_url || '');
      setAuthGroup(String(settings.organizr_auth_group || '998'));
    } catch {
      showErrorToast('Impossible de charger la config Organizr');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setStatusLabel(null);
      await persist();
      showToast('Configuration Organizr enregistrée');
      await load();
    } catch (err: any) {
      showErrorToast(err?.message || 'Erreur de sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setStatusLabel(null);
      await persist();
      const result = await api.testOrganizrSso();
      setStatusLabel(result.message || 'API Organizr joignable');
      showToast('Test Organizr OK');
    } catch (err: any) {
      setStatusLabel(null);
      showErrorToast(err?.message || 'Organizr inaccessible');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-8 border-white/5 text-gray-500 text-xs font-black uppercase tracking-widest">
        Chargement Organizr…
      </div>
    );
  }

  return (
    <div className="glass-card p-8 space-y-8 border-white/5">
      <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
        <LayoutDashboard className="text-orange-400" size={24} />
        SSO Organizr
      </h3>
      <p className="text-[11px] text-gray-500 font-medium normal-case tracking-normal">
        Si l’utilisateur arrive déjà connecté à Organizr (cookie), Search ouvre la session
        sans mot de passe. Sinon : login Search classique. Même nom d’utilisateur requis.
      </p>

      <div className="space-y-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/40"
          />
          <span className="text-sm font-bold text-gray-300">Activer le SSO Organizr</span>
        </label>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">
            URL API interne
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-orange-500/40 transition-all"
            placeholder="http://lab-organizr"
          />
          <p className="text-[10px] text-gray-600 ml-1">
            Adresse Organizr joignable depuis le conteneur Search (réseau Docker).
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">
            Groupe Server Auth
          </label>
          <input
            type="text"
            value={authGroup}
            onChange={(e) => setAuthGroup(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-orange-500/40 transition-all"
            placeholder="998"
          />
          <p className="text-[10px] text-gray-600 ml-1">
            <code className="text-gray-500">998</code> = tout utilisateur Organizr connecté (recommandé).
          </p>
        </div>

        {statusLabel && (
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 size={14} /> {statusLabel}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !url.trim()}
            className="px-5 py-3 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
          >
            <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
            Tester
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-3 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
