import React, { useState, useEffect } from 'react';
import { Trash2, Settings, Users, Rss, SlidersHorizontal, HardDrive, Activity, Shield, Cpu, Key, Database, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { UserSettingsModal } from '../components/settings/UserSettingsModal';
import { AdminRssFeedManager } from '../components/rss/AdminRssFeedManager';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { globalSettings } from '../services/settings';

interface User {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  qbit_url?: string;
  qbit_username?: string;
  qbit_password?: string;
  download_path_movies?: string;
  download_path_series?: string;
  download_path_anime?: string;
  allow_force_interactive_download?: boolean;
}

type QualitySortBy = 'seeds_desc' | 'size_asc' | 'size_desc' | 'date_desc' | 'date_asc';

export interface QualityProfile {
  id: string;
  name: string;
  min_size_mb: number;
  max_size_mb: number;
  required_keywords: string[];
  blocked_keywords: string[];
  sort_by: QualitySortBy;
}

export interface QualityProfileAssignments {
  movie_profile_id: string;
  tv_profile_id: string;
}

export function AdminPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false });
  const [globalConfig, setGlobalConfig] = useState({
    prowlarr_url: '',
    prowlarr_api_key: '',
    tmdb_access_token: '',
    min_seeds: 3,
    auto_search_interval_minutes: 60,
    media_scan_interval_minutes: 30,
    media_requests_auto_delete_completed_after_hours: 24
  });
  const [autoSearchIntervalInput, setAutoSearchIntervalInput] = useState<string>('60');
  const [mediaScanIntervalInput, setMediaScanIntervalInput] = useState<string>('30');
  const [autoDeleteCompletedHoursInput, setAutoDeleteCompletedHoursInput] = useState<string>('24');
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
  const [qualityAssignments, setQualityAssignments] = useState<QualityProfileAssignments>({
    movie_profile_id: '',
    tv_profile_id: ''
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mediaInventoryScanStatus, setMediaInventoryScanStatus] = useState<any>(null);
  const [isPollingMediaInventoryScan, setIsPollingMediaInventoryScan] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  useEffect(() => { if (currentUser && !currentUser.is_admin) window.location.href = '/'; }, [currentUser]);
  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => {
    if (activeTab !== 'settings') return;
    let interval: number | undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await api.getMediaInventoryScanStatus();
        if (cancelled) return;
        setMediaInventoryScanStatus(data?.status ?? null);
        const running = Boolean(data?.status?.running);
        setIsPollingMediaInventoryScan(running);
        if (!running && interval != null) { window.clearInterval(interval); interval = undefined; }
      } catch { }
    };
    refresh();
    interval = window.setInterval(refresh, 2000);
    return () => { cancelled = true; if (interval != null) window.clearInterval(interval); };
  }, [activeTab]);

  const loadInitialData = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setIsLoading(true);
      const loadedUsers = await api.getUsers();
      setUsers(loadedUsers || []);
      const settings = await globalSettings.load();
      if (settings) {
        const intervalValue = (settings as any).auto_search_interval_minutes ?? 60;
        const mediaIntervalValue = (settings as any).media_scan_interval_minutes ?? 30;
        const autoDeleteHoursValue = (settings as any).media_requests_auto_delete_completed_after_hours ?? 24;
        setGlobalConfig({
          prowlarr_url: settings.prowlarr_url || '',
          prowlarr_api_key: settings.prowlarr_api_key || '',
          tmdb_access_token: settings.tmdb_access_token || '',
          min_seeds: (settings as any).min_seeds ?? 3,
          auto_search_interval_minutes: intervalValue,
          media_scan_interval_minutes: mediaIntervalValue,
          media_requests_auto_delete_completed_after_hours: autoDeleteHoursValue
        });
        setAutoSearchIntervalInput(String(intervalValue));
        setMediaScanIntervalInput(String(mediaIntervalValue));
        setAutoDeleteCompletedHoursInput(String(autoDeleteHoursValue));
        const profilesRaw = Array.isArray((settings as any).quality_profiles) ? (settings as any).quality_profiles : [];
        const assignments = (settings as any).quality_profile_assignments || null;
        if (Array.isArray(profilesRaw)) {
          const normalized = profilesRaw.map((p: any) => ({
            id: String(p?.id || ''),
            name: String(p?.name || ''),
            min_size_mb: p?.min_size_mb ?? Math.round((p?.min_size_gb || 0) * 1024),
            max_size_mb: p?.max_size_mb ?? Math.round((p?.max_size_gb || 0) * 1024),
            required_keywords: Array.isArray(p?.required_keywords) ? p.required_keywords : [],
            blocked_keywords: Array.isArray(p?.blocked_keywords) ? p.blocked_keywords : [],
            sort_by: (p?.sort_by as QualitySortBy) || 'seeds_desc'
          })).filter(p => p.id);
          setQualityProfiles(normalized);
          if (normalized.length > 0 && !selectedProfileId) setSelectedProfileId(normalized[0].id);
        }
        if (assignments) setQualityAssignments({ movie_profile_id: assignments.movie_profile_id || '', tv_profile_id: assignments.tv_profile_id || '' });
      }
    } catch { setError('Sync error'); }
    finally { if (!options?.silent) setIsLoading(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.createUser(newUser.username, newUser.password, newUser.is_admin); setSuccess('Identité créée'); setNewUser({ username: '', password: '', is_admin: false }); loadInitialData(); }
    catch { setError('Échec de création'); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalSettings.save({
        ...globalConfig,
        auto_search_interval_minutes: parseInt(autoSearchIntervalInput) || 60,
        media_scan_interval_minutes: parseInt(mediaScanIntervalInput) || 30,
        media_requests_auto_delete_completed_after_hours: parseInt(autoDeleteCompletedHoursInput) || 24
      });
      setSuccess('Noyau système mis à jour');
    } catch { setError('Échec de sauvegarde'); }
  };

  const isProfileAssigned = (id: string) => qualityAssignments.movie_profile_id === id || qualityAssignments.tv_profile_id === id;

  if (isLoading) return <div className="flex items-center justify-center py-32"><div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!currentUser?.is_admin) return null;

  return (
    <div className="animate-premium-fade space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
            <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tighter uppercase leading-none">Administration</h1>
          </div>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em] ml-4">Terminal de contrôle central • V1.2.0</p>
        </div>

        <div className="grid grid-cols-2 md:flex flex-wrap gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
          {[
            { id: 'users', label: 'UTILISATEURS', icon: Users, color: 'blue' },
            { id: 'settings', label: 'CONFIGURATION', icon: Cpu, color: 'violet' },
            { id: 'quality', label: 'QUALITÉ', icon: SlidersHorizontal, color: 'blue' },
            { id: 'rss', label: 'RÉSEAUX RSS', icon: Rss, color: 'orange' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-500 font-black text-[10px] tracking-widest ${activeTab === tab.id
                  ? `bg-${tab.color}-600 text-white shadow-xl shadow-${tab.color}-600/30`
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {(error || success) && (
        <div className={`p-4 rounded-2xl border flex items-center gap-4 animate-premium-fade ${error ? 'bg-red-600/10 border-red-600/20 text-red-400' : 'bg-green-600/10 border-green-600/20 text-green-400'}`}>
          <Shield size={20} />
          <span className="text-[11px] font-black uppercase tracking-widest">{error || success}</span>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
              <Users className="text-blue-500" size={24} />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Accès Autorisés</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {users.map((u) => (
                <div key={u.id} className="glass-card p-6 group hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                        {u.username.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-black text-white uppercase tracking-tighter text-lg flex items-center gap-3">
                          {u.username}
                          {u.is_admin && <span className="text-[9px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-lg uppercase tracking-widest">Master</span>}
                        </h3>
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-1">ID: {u.id.substring(0, 8)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setSelectedUser(u)} className="p-3 bg-white/5 hover:bg-blue-600/20 text-gray-500 hover:text-blue-400 rounded-xl transition-all"><Settings size={18} /></button>
                      {!u.is_admin && <button onClick={() => {
                        setConfirmConfig({
                          isOpen: true,
                          title: 'Révoquer l’accès ?',
                          message: `L'utilisateur ${u.username} ne pourra plus se connecter au terminal.`,
                          onConfirm: () => api.deleteUser(u.id).then(loadInitialData)
                        });
                      }} className="p-3 bg-white/5 hover:bg-red-600/20 text-gray-500 hover:text-red-400 rounded-xl transition-all"><Trash2 size={18} /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="glass-card p-8 border-white/10 shadow-2xl bg-gray-950/40">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                <Key className="text-blue-500" size={20} /> Provisionnement
              </h3>
              <form onSubmit={handleAddUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Username</label>
                  <input type="text" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500/40 transition-all" required />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Secret Key</label>
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-blue-500/40 transition-all" required />
                </div>
                <label className="flex items-center gap-4 cursor-pointer group p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all">
                  <input type="checkbox" checked={newUser.is_admin} onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} className="w-5 h-5 rounded-lg border-white/10 bg-white/5 text-blue-600 transition-all" />
                  <span className="text-[11px] font-black text-gray-500 group-hover:text-white uppercase tracking-widest">Privilèges Admin</span>
                </label>
                <button type="submit" className="w-full bg-blue-600 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all">Initialiser l'Accès</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="glass-card p-8 space-y-8 border-white/5">
            <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-500 flex items-center justify-center font-black">P</div>
              Indexation Prowlarr
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">URL Service</label>
                <input type="url" value={globalConfig.prowlarr_url} onChange={(e) => setGlobalConfig({ ...globalConfig, prowlarr_url: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-blue-500/40 transition-all" placeholder="http://prowlarr:9696" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Clé de Sécurité</label>
                <input type="password" value={globalConfig.prowlarr_api_key} onChange={(e) => setGlobalConfig({ ...globalConfig, prowlarr_api_key: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-blue-500/40 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Seuil Seeds Minimal</label>
                <input type="number" value={globalConfig.min_seeds} onChange={(e) => setGlobalConfig({ ...globalConfig, min_seeds: parseInt(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-blue-500/40 transition-all" />
              </div>
            </div>
          </div>

          <div className="glass-card p-8 space-y-8 border-white/5">
            <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
              <Database className="text-green-500" size={24} /> Métadonnées TMDB
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Token Authentification (v4)</label>
                <input type="password" value={globalConfig.tmdb_access_token} onChange={(e) => setGlobalConfig({ ...globalConfig, tmdb_access_token: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-green-500/40 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Intervalle de Scan (MIN)</label>
                <input type="number" value={autoSearchIntervalInput} onChange={(e) => setAutoSearchIntervalInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-green-500/40 transition-all" />
              </div>
            </div>
          </div>

          <div className="glass-card p-8 space-y-8 border-white/5">
            <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
              <HardDrive size={24} className="text-amber-400" /> Planification Scan
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Frequence Indexation Globale (min)</label>
                <input type="number" value={mediaScanIntervalInput} onChange={(e) => setMediaScanIntervalInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-amber-500/40 transition-all" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button type="button" onClick={() => api.scanMediaInventoryNow()} className="w-full py-4 bg-amber-600/10 text-amber-500 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-amber-500/20 hover:bg-amber-600/20 transition-all flex items-center justify-center gap-3">
                  <Activity size={18} className={isPollingMediaInventoryScan ? 'animate-spin' : ''} /> Lancer un Scan Rapide
                </button>
                <button type="button" onClick={async () => {
                  if (window.confirm("Voulez-vous forcer un scan complet ? Cela va vider la table d'indexation locale et tout reconstruire à partir du disque.")) {
                    await api.scanMediaInventoryNow({ force: true });
                  }
                }} className="w-full py-4 bg-red-600/10 text-red-500 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-red-500/20 hover:bg-red-600/20 transition-all flex items-center justify-center gap-3">
                  <RefreshCw size={18} className={isPollingMediaInventoryScan ? 'animate-spin' : ''} /> Lancer un Scan Complet
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 space-y-8 border-white/5">
            <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
              <Trash2 size={24} className="text-red-500" /> Purge & Cleanup
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Auto-Delete Finished (H)</label>
                <input type="number" value={autoDeleteCompletedHoursInput} onChange={(e) => setAutoDeleteCompletedHoursInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-red-500/40 transition-all" />
              </div>
              <div className="pt-8">
                <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black uppercase text-sm tracking-[0.3em] rounded-2xl shadow-2xl shadow-blue-600/40 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all">Synchroniser le Noyau</button>
              </div>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'quality' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1 space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
              <SlidersHorizontal className="text-blue-500" size={24} />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Profils</h2>
            </div>
            <div className="glass-card p-6 space-y-6">
              <div className="flex flex-col 2xl:flex-row gap-2">
                <input type="text" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black text-white uppercase tracking-widest focus:ring-2 focus:ring-blue-500/40 outline-none" placeholder="NOUVEAU PROFIL..." />
                <button onClick={() => { if (newProfileName.trim()) { const id = crypto.randomUUID(); setQualityProfiles([{ id, name: newProfileName, min_size_mb: 0, max_size_mb: 0, required_keywords: [], blocked_keywords: [], sort_by: 'seeds_desc' }, ...qualityProfiles]); setSelectedProfileId(id); setNewProfileName(''); } }} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 whitespace-nowrap">AJOUTER</button>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {qualityProfiles.map(p => (
                  <div key={p.id} onClick={() => setSelectedProfileId(p.id)} className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedProfileId === p.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                    <span className={`text-[11px] font-black uppercase tracking-widest truncate ${selectedProfileId === p.id ? 'text-blue-400' : 'text-gray-500'}`}>{p.name}</span>
                    {!isProfileAssigned(p.id) && <button onClick={(e) => {
                      e.stopPropagation();
                      setConfirmConfig({
                        isOpen: true,
                        title: 'Supprimer le profil ?',
                        message: `Le profil de qualité "${p.name}" sera définitivement supprimé.`,
                        onConfirm: () => setQualityProfiles(qualityProfiles.filter(x => x.id !== p.id))
                      });
                    }} className="p-2 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            {selectedProfileId && qualityProfiles.find(p => p.id === selectedProfileId) && (
              <div className="glass-card p-10 space-y-12 animate-premium-fade">
                <div className="flex items-center justify-between border-b border-white/5 pb-8">
                  <h3 className="text-xl lg:text-2xl font-black text-white tracking-tighter uppercase">{qualityProfiles.find(p => p.id === selectedProfileId)?.name}</h3>
                  <button onClick={async () => { try { await api.updateSettings({ quality_profiles: qualityProfiles, quality_profile_assignments: qualityAssignments }); setSuccess('Profils Qualité Synchronisés'); } catch { setError('Sync Error'); } }} className="px-8 py-3 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-blue-600/40 hover:bg-blue-500 transition-all">Sauvegarder</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> Restrictions de Taille</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">MIN (MB)</label>
                        <input type="number" value={qualityProfiles.find(p => p.id === selectedProfileId)?.min_size_mb} onChange={(e) => setQualityProfiles(qualityProfiles.map(p => p.id === selectedProfileId ? { ...p, min_size_mb: parseInt(e.target.value) || 0 } : p))} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black outline-none focus:ring-2 focus:ring-blue-500/40" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">MAX (MB)</label>
                        <input type="number" value={qualityProfiles.find(p => p.id === selectedProfileId)?.max_size_mb} onChange={(e) => setQualityProfiles(qualityProfiles.map(p => p.id === selectedProfileId ? { ...p, max_size_mb: parseInt(e.target.value) || 0 } : p))} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black outline-none focus:ring-2 focus:ring-blue-500/40" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_blue]" /> Priorité Indexation</h4>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Tri des Résultats</label>
                      <select 
                        value={qualityProfiles.find(p => p.id === selectedProfileId)?.sort_by} 
                        onChange={(e) => setQualityProfiles(qualityProfiles.map(p => p.id === selectedProfileId ? { ...p, sort_by: e.target.value as any } : p))} 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/40 transition-all"
                      >
                        <option value="seeds_desc" className="bg-gray-900 text-white">Seeds (Descending)</option>
                        <option value="size_desc" className="bg-gray-900 text-white">Taille (Descending)</option>
                        <option value="size_asc" className="bg-gray-900 text-white">Taille (Ascending)</option>
                        <option value="date_desc" className="bg-gray-900 text-white">Date (Descending)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_green]" /> Mots-clés Requis (Langues, etc.)</h4>
                    <p className="text-[10px] text-gray-600 font-medium">Exemple: MULTI, VFF, FRENCH, VOSTFR (Séparez par des virgules)</p>
                    <textarea 
                      value={qualityProfiles.find(p => p.id === selectedProfileId)?.required_keywords.join(', ')} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setQualityProfiles(qualityProfiles.map(p => p.id === selectedProfileId ? { ...p, required_keywords: val.split(',').map(k => k.trimStart()) } : p))
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs font-bold focus:ring-2 focus:ring-green-500/40 h-24 outline-none resize-none"
                      placeholder="MULTI, VFF..."
                    />
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_red]" /> Mots-clés Bloqués</h4>
                    <p className="text-[10px] text-gray-600 font-medium">Exemple: CAM, TS, HDCAM (Séparez par des virgules)</p>
                    <textarea 
                      value={qualityProfiles.find(p => p.id === selectedProfileId)?.blocked_keywords.join(', ')} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setQualityProfiles(qualityProfiles.map(p => p.id === selectedProfileId ? { ...p, blocked_keywords: val.split(',').map(k => k.trimStart()) } : p))
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs font-bold focus:ring-2 focus:ring-red-500/40 h-24 outline-none resize-none"
                      placeholder="CAM, TS..."
                    />
                  </div>
                </div>

                <div className="pt-12 border-t border-white/5 space-y-8">
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                      <Settings className="text-blue-500" size={20} /> Assignation des Profils
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Profil par défaut : FILMS</label>
                        <select 
                          value={qualityAssignments.movie_profile_id} 
                          onChange={(e) => setQualityAssignments({ ...qualityAssignments, movie_profile_id: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-[11px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-gray-900">Aucun profil</option>
                          {qualityProfiles.map(p => <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Profil par défaut : SÉRIES / ANIME</label>
                        <select 
                          value={qualityAssignments.tv_profile_id} 
                          onChange={(e) => setQualityAssignments({ ...qualityAssignments, tv_profile_id: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-[11px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-gray-900">Aucun profil</option>
                          {qualityProfiles.map(p => <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>)}
                        </select>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rss' && (
        <div className="animate-premium-fade space-y-10">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <Rss className="text-orange-500" size={24} />
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Gestionnaire de Flux RSS</h2>
          </div>
          <div className="glass-card p-1">
            <AdminRssFeedManager user={currentUser!} />
          </div>
        </div>
      )}

      {selectedUser && (
        <UserSettingsModal
          user={selectedUser}
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={(updatedUser) => {
            if (updatedUser) setSelectedUser(updatedUser);
            loadInitialData({ silent: true });
          }}
        />
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </div>
  );
}