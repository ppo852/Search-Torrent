import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Settings, Users, Rss, SlidersHorizontal, HardDrive, Activity, Shield, Cpu, Key, Database, RefreshCw, CheckCircle2, Calendar, Copy } from 'lucide-react';
import { getActivityEventLabel, formatActivityDetails } from '../lib/activity-log-labels';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { UserSettingsModal } from '../components/settings/UserSettingsModal';
import { AdminEmbyConnectionPanel, AdminEmbyInventoryPanel } from '../components/settings/AdminEmbyPanel';
import { AdminOrganizrPanel } from '../components/settings/AdminOrganizrPanel';
import { AdminRssFeedManager } from '../components/rss/AdminRssFeedManager';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { globalSettings } from '../services/settings';
import { showErrorToast, showInfoToast, showToast } from '../stores/toastStore';
import type { AdminUser } from '../types';

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
  animation_profile_id: string;
  tv_profile_id: string;
  anime_profile_id: string;
}

function ProfileAssignSelect({
  label,
  value,
  profiles,
  emptyLabel = 'Aucun profil',
  onChange,
}: {
  label: string;
  value: string;
  profiles: QualityProfile[];
  emptyLabel?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-[11px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer"
      >
        <option value="" className="bg-gray-900">{emptyLabel}</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>
        ))}
      </select>
    </div>
  );
}

export function AdminPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('system');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false });
  const [globalConfig, setGlobalConfig] = useState({
    prowlarr_url: '',
    prowlarr_api_key: '',
    tmdb_access_token: '',
    min_seeds: 0,
    auto_search_interval_minutes: 60,
    media_scan_interval_minutes: 30,
    media_requests_auto_delete_completed_after_hours: 24,
    calendar_api_key: ''
  });
  const [autoSearchIntervalInput, setAutoSearchIntervalInput] = useState<string>('60');
  const [mediaScanIntervalInput, setMediaScanIntervalInput] = useState<string>('30');
  const [autoDeleteCompletedHoursInput, setAutoDeleteCompletedHoursInput] = useState<string>('24');
  const [embySyncIntervalInput, setEmbySyncIntervalInput] = useState<string>('60');
  const [isTestingProwlarr, setIsTestingProwlarr] = useState(false);
  const [isTestingTmdb, setIsTestingTmdb] = useState(false);
  const [isSavingProwlarr, setIsSavingProwlarr] = useState(false);
  const [isSavingTmdb, setIsSavingTmdb] = useState(false);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);
  const [isSavingCalendar, setIsSavingCalendar] = useState(false);
  const [prowlarrLabel, setProwlarrLabel] = useState<string | null>(null);
  const [tmdbLabel, setTmdbLabel] = useState<string | null>(null);
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
  const [qualityAssignments, setQualityAssignments] = useState<QualityProfileAssignments>({
    movie_profile_id: '',
    animation_profile_id: '',
    tv_profile_id: '',
    anime_profile_id: ''
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [activeScanMode, setActiveScanMode] = useState<'quick' | 'full' | null>(null);
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
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const wasScanRunning = useRef(false);

  useEffect(() => { if (currentUser && !currentUser.is_admin) window.location.href = '/'; }, [currentUser]);
  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => {
    if (activeTab !== 'inventory') return;
    let interval: number | undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await api.getMediaInventoryScanStatus();
        if (cancelled) return;
        const status = data?.status ?? null;
        const running = Boolean(status?.running);
        if (wasScanRunning.current && !running) {
          if (status?.lastError) {
            showErrorToast(`Scan terminé avec erreur : ${status.lastError}`);
          } else {
            showToast('Scan terminé');
          }
        }
        wasScanRunning.current = running;
        if (!running) setActiveScanMode(null);
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
        const embySyncIntervalValue = (settings as any).emby_sync_interval_minutes ?? 60;
        setGlobalConfig({
          prowlarr_url: settings.prowlarr_url || '',
          prowlarr_api_key: settings.prowlarr_api_key || '',
          tmdb_access_token: settings.tmdb_access_token || '',
          min_seeds: (settings as any).min_seeds ?? 0,
          auto_search_interval_minutes: intervalValue,
          media_scan_interval_minutes: mediaIntervalValue,
          media_requests_auto_delete_completed_after_hours: autoDeleteHoursValue,
          calendar_api_key: (settings as any).calendar_api_key || ''
        });
        setAutoSearchIntervalInput(String(intervalValue));
        setMediaScanIntervalInput(String(mediaIntervalValue));
        setAutoDeleteCompletedHoursInput(String(autoDeleteHoursValue));
        setEmbySyncIntervalInput(String(embySyncIntervalValue));
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
        if (assignments) {
          setQualityAssignments({
            movie_profile_id: assignments.movie_profile_id || '',
            animation_profile_id: assignments.animation_profile_id || assignments.movie_profile_id || '',
            tv_profile_id: assignments.tv_profile_id || '',
            anime_profile_id: assignments.anime_profile_id || assignments.tv_profile_id || '',
          });
        }
      }
    } catch { showErrorToast('Sync error'); }
    finally { if (!options?.silent) setIsLoading(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.createUser(newUser.username, newUser.password, newUser.is_admin); showToast('Identité créée'); setNewUser({ username: '', password: '', is_admin: false }); loadInitialData(); }
    catch { showErrorToast('Échec de création'); }
  };

  const handleSaveProwlarr = async () => {
    try {
      setIsSavingProwlarr(true);
      await api.updateSettings({
        prowlarr_url: globalConfig.prowlarr_url,
        prowlarr_api_key: globalConfig.prowlarr_api_key,
        min_seeds: globalConfig.min_seeds,
      });
      showToast('Prowlarr sauvegardé');
    } catch {
      showErrorToast('Échec de sauvegarde Prowlarr');
    } finally {
      setIsSavingProwlarr(false);
    }
  };

  const handleSaveTmdb = async () => {
    try {
      setIsSavingTmdb(true);
      await api.updateSettings({
        tmdb_access_token: globalConfig.tmdb_access_token,
      });
      showToast('TMDB sauvegardé');
    } catch {
      showErrorToast('Échec de sauvegarde TMDB');
    } finally {
      setIsSavingTmdb(false);
    }
  };

  const buildCalendarIcsUrl = (token: string) => {
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/calendar.ics?token=${encodeURIComponent(token)}`;
  };

  const handleGenerateCalendarKey = async () => {
    try {
      setIsSavingCalendar(true);
      const data = await api.generateCalendarApiKey();
      setGlobalConfig((prev) => ({ ...prev, calendar_api_key: data.calendar_api_key || '' }));
      showToast('Clé calendrier générée');
    } catch {
      showErrorToast('Échec de génération de la clé calendrier');
    } finally {
      setIsSavingCalendar(false);
    }
  };

  const handleCopyCalendarUrl = async () => {
    const url = buildCalendarIcsUrl(globalConfig.calendar_api_key);
    if (!url) {
      showErrorToast('Génère d’abord une clé calendrier');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL iCal copiée');
    } catch {
      showInfoToast(url);
    }
  };

  const handleSaveAutomation = async () => {
    try {
      setIsSavingAutomation(true);
      const autoDeleteHours = parseInt(autoDeleteCompletedHoursInput, 10);
      const embySync = parseInt(embySyncIntervalInput, 10);
      if (!Number.isFinite(embySync) || embySync < 5) {
        showErrorToast('L\'intervalle Emby doit être d\'au moins 5 minutes');
        return;
      }
      await api.updateSettings({
        auto_search_interval_minutes: parseInt(autoSearchIntervalInput) || 60,
        media_scan_interval_minutes: parseInt(mediaScanIntervalInput) || 30,
        media_requests_auto_delete_completed_after_hours:
          Number.isFinite(autoDeleteHours) && autoDeleteHours >= 0 ? autoDeleteHours : 24,
        emby_sync_interval_minutes: embySync,
      });
      showToast('Inventaire & planification sauvegardés');
    } catch {
      showErrorToast('Échec de sauvegarde');
    } finally {
      setIsSavingAutomation(false);
    }
  };

  const handleTestProwlarr = async () => {
    try {
      setIsTestingProwlarr(true);
      setProwlarrLabel(null);
      const result = await api.testProwlarrConnection({
        url: globalConfig.prowlarr_url,
        api_key: globalConfig.prowlarr_api_key,
      });
      const label = [result.appName, result.version].filter(Boolean).join(' · ');
      setProwlarrLabel(label || 'Connexion OK');
      showToast('Connexion Prowlarr réussie');
    } catch (err: any) {
      setProwlarrLabel(null);
      showErrorToast(err?.message || 'Échec de connexion Prowlarr');
    } finally {
      setIsTestingProwlarr(false);
    }
  };

  const handleTestTmdb = async () => {
    try {
      setIsTestingTmdb(true);
      setTmdbLabel(null);
      await api.testTmdbConnection({
        access_token: globalConfig.tmdb_access_token,
      });
      setTmdbLabel('Connexion OK');
      showToast('Connexion TMDB réussie');
    } catch (err: any) {
      setTmdbLabel(null);
      showErrorToast(err?.message || 'Échec de connexion TMDB');
    } finally {
      setIsTestingTmdb(false);
    }
  };

  const launchMediaInventoryScan = async (options?: { force?: boolean }) => {
    const mode = options?.force ? 'full' : 'quick';
    try {
      await api.scanMediaInventoryNow(options);
      wasScanRunning.current = true;
      setActiveScanMode(mode);
      showInfoToast(mode === 'full' ? 'Scan complet lancé…' : 'Scan rapide lancé…');
    } catch (err: any) {
      showErrorToast(err?.message || 'Impossible de lancer le scan');
    }
  };

  const refreshSystemHealth = async () => {
    try {
      setIsHealthLoading(true);
      const data = await api.getSystemHealth();
      setSystemHealth(data);
    } catch {
      showErrorToast('Impossible de tester les services');
    } finally {
      setIsHealthLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setIsBackupLoading(true);
      await api.downloadDatabaseBackup();
      showToast('Sauvegarde téléchargée');
    } catch {
      showErrorToast('Échec du téléchargement de la base');
    } finally {
      setIsBackupLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'system') {
      refreshSystemHealth();
    }
    if (activeTab === 'history') {
      loadActivityLog();
    }
  }, [activeTab]);

  const loadActivityLog = async () => {
    try {
      setIsActivityLoading(true);
      const data = await api.getAdminActivity(150);
      setActivityItems(data.items || []);
    } catch {
      showErrorToast('Impossible de charger l\'historique');
    } finally {
      setIsActivityLoading(false);
    }
  };

  const isProfileAssigned = (id: string) =>
    qualityAssignments.movie_profile_id === id ||
    qualityAssignments.animation_profile_id === id ||
    qualityAssignments.tv_profile_id === id ||
    qualityAssignments.anime_profile_id === id;

  if (isLoading) return <div className="flex items-center justify-center py-32"><div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!currentUser?.is_admin) return null;

  return (
    <div className="animate-premium-fade space-y-12 pb-20">
      <div className="flex justify-end border-b border-white/5 pb-8">
        <div className="flex overflow-x-auto pb-2 -mx-1 px-1 md:overflow-visible md:pb-0 w-full md:w-auto">
          <div className="flex md:flex-wrap gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl min-w-max">
          {[
            { id: 'system', label: 'SYSTÈME', icon: Database, activeClass: 'bg-green-600 text-white shadow-xl shadow-green-600/30' },
            { id: 'integrations', label: 'INTÉGRATIONS', icon: Cpu, activeClass: 'bg-violet-600 text-white shadow-xl shadow-violet-600/30' },
            { id: 'inventory', label: 'INVENTAIRE', icon: HardDrive, activeClass: 'bg-amber-600 text-white shadow-xl shadow-amber-600/30' },
            { id: 'quality', label: 'QUALITÉ', icon: SlidersHorizontal, activeClass: 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' },
            { id: 'rss', label: 'FLUX RSS', icon: Rss, activeClass: 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' },
            { id: 'users', label: 'UTILISATEURS', icon: Users, activeClass: 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' },
            { id: 'history', label: 'HISTORIQUE', icon: Shield, activeClass: 'bg-violet-600 text-white shadow-xl shadow-violet-600/30' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-5 py-2.5 rounded-xl flex items-center gap-2 sm:gap-3 transition-all duration-500 font-black text-[10px] tracking-widest whitespace-nowrap ${activeTab === tab.id
                  ? tab.activeClass
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
          </div>
        </div>
      </div>

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
                <Key className="text-blue-500" size={20} /> Création d'utilisateur
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

      {activeTab === 'integrations' && (
        <div className="space-y-12">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <Cpu className="text-violet-500" size={24} />
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Connexions externes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
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
                {prowlarrLabel && (
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14} /> {prowlarrLabel}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestProwlarr}
                    disabled={isTestingProwlarr || !globalConfig.prowlarr_url.trim() || !globalConfig.prowlarr_api_key.trim()}
                    className="px-5 py-3 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={isTestingProwlarr ? 'animate-spin' : ''} />
                    Tester
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProwlarr}
                    disabled={isSavingProwlarr}
                    className="px-5 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50"
                  >
                    {isSavingProwlarr ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
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
                {tmdbLabel && (
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14} /> {tmdbLabel}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestTmdb}
                    disabled={isTestingTmdb || !globalConfig.tmdb_access_token.trim()}
                    className="px-5 py-3 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={isTestingTmdb ? 'animate-spin' : ''} />
                    Tester
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTmdb}
                    disabled={isSavingTmdb}
                    className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50"
                  >
                    {isSavingTmdb ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <AdminEmbyConnectionPanel />

          <AdminOrganizrPanel />

          <div className="glass-card p-8 space-y-8 border-white/5">
            <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
              <Calendar className="text-sky-400" size={24} /> Calendrier Organizr (iCal)
            </h3>
            <p className="text-[11px] text-gray-500 font-medium normal-case tracking-normal">
              Lien secret pour afficher les sorties des séries et animes demandés (en cours) dans le calendrier Organizr.
              Colle l’URL dans Homepage Items → iCal.
            </p>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Clé API calendrier</label>
                <input
                  type="password"
                  readOnly
                  value={globalConfig.calendar_api_key}
                  placeholder="Non générée"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-sky-500/40 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">URL iCal (à coller dans Organizr)</label>
                <input
                  type="text"
                  readOnly
                  value={buildCalendarIcsUrl(globalConfig.calendar_api_key)}
                  placeholder="Génère une clé pour obtenir l’URL"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs tracking-wide focus:ring-2 focus:ring-sky-500/40 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateCalendarKey}
                  disabled={isSavingCalendar}
                  className="px-5 py-3 bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Key size={14} />
                  {isSavingCalendar ? 'Génération…' : globalConfig.calendar_api_key ? 'Régénérer la clé' : 'Générer la clé'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyCalendarUrl}
                  disabled={!globalConfig.calendar_api_key}
                  className="px-5 py-3 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  <Copy size={14} />
                  Copier l’URL
                </button>
              </div>
              {globalConfig.calendar_api_key && (
                <p className="text-[10px] font-black text-amber-400/90 uppercase tracking-widest">
                  Régénérer invalide l’ancienne URL Organizr — recolle la nouvelle.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-10">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <HardDrive className="text-amber-500" size={24} />
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Inventaire & planification</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-8 space-y-6 border-white/5">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
                  <Activity className="text-violet-400" size={24} /> Recherche auto des demandes
                </h3>
                <p className="text-[11px] text-gray-500 mt-2 font-medium normal-case tracking-normal">
                  Relance Prowlarr pour les films et saisons encore en attente dans la bibliothèque.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Intervalle (minutes)</label>
                <input type="number" value={autoSearchIntervalInput} onChange={(e) => setAutoSearchIntervalInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-violet-500/40 transition-all" />
              </div>
            </div>

            <div className="glass-card p-8 space-y-6 border-white/5">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
                  <HardDrive size={24} className="text-amber-400" /> Indexation du disque
                </h3>
                <p className="text-[11px] text-gray-500 mt-2 font-medium normal-case tracking-normal">
                  Parcourt les dossiers de téléchargement pour détecter les fichiers déjà présents (films, animations, séries, animes).
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Intervalle (minutes)</label>
                <input type="number" value={mediaScanIntervalInput} onChange={(e) => setMediaScanIntervalInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-amber-500/40 transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => launchMediaInventoryScan()} className="w-full py-3 bg-amber-600/10 text-amber-500 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-amber-500/20 hover:bg-amber-600/20 transition-all flex items-center justify-center gap-2">
                  <Activity size={16} className={activeScanMode === 'quick' ? 'animate-spin' : ''} /> Scan rapide
                </button>
                <button type="button" onClick={() => {
                  setConfirmConfig({
                    isOpen: true,
                    title: 'Forcer un scan complet ?',
                    message: "La table d'indexation locale sera vidée puis reconstruite à partir du disque.",
                    onConfirm: () => { launchMediaInventoryScan({ force: true }); }
                  });
                }} className="w-full py-3 bg-red-600/10 text-red-500 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-red-500/20 hover:bg-red-600/20 transition-all flex items-center justify-center gap-2">
                  <RefreshCw size={16} className={activeScanMode === 'full' ? 'animate-spin' : ''} /> Scan complet
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AdminEmbyInventoryPanel
              onGoToIntegrations={() => setActiveTab('integrations')}
              syncInterval={embySyncIntervalInput}
              onSyncIntervalChange={setEmbySyncIntervalInput}
            />

            <div className="glass-card p-8 space-y-6 border-white/5">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
                  <Trash2 size={24} className="text-red-500" /> Nettoyage de la bibliothèque
                </h3>
                <p className="text-[11px] text-gray-500 mt-2 font-medium normal-case tracking-normal">
                  Supprime les demandes marquées terminées après un délai. Ne supprime pas les fichiers sur le disque.
                  Mettre <strong className="text-gray-400">0</strong> pour purger dès le prochain scan disque.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Délai après fin de demande (heures)</label>
                <input type="number" min={0} value={autoDeleteCompletedHoursInput} onChange={(e) => setAutoDeleteCompletedHoursInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black focus:ring-2 focus:ring-red-500/40 transition-all" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveAutomation}
              disabled={isSavingAutomation}
              className="px-8 py-4 bg-violet-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-violet-600/30 hover:bg-violet-500 transition-all disabled:opacity-50"
            >
              {isSavingAutomation ? 'Sauvegarde…' : 'Tout sauvegarder'}
            </button>
          </div>
        </div>
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
                  <button onClick={async () => { try { await api.updateSettings({ quality_profiles: qualityProfiles, quality_profile_assignments: qualityAssignments }); showToast('Profils Qualité Synchronisés'); } catch { showErrorToast('Sync Error'); } }} className="px-8 py-3 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-blue-600/40 hover:bg-blue-500 transition-all">Sauvegarder</button>
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
                      <ProfileAssignSelect
                        label="Profil par défaut : FILMS"
                        value={qualityAssignments.movie_profile_id}
                        profiles={qualityProfiles}
                        onChange={(id) => setQualityAssignments({ ...qualityAssignments, movie_profile_id: id })}
                      />
                      <ProfileAssignSelect
                        label="Profil par défaut : ANIMATION"
                        value={qualityAssignments.animation_profile_id}
                        profiles={qualityProfiles}
                        emptyLabel="Aucun profil (repli Films)"
                        onChange={(id) => setQualityAssignments({ ...qualityAssignments, animation_profile_id: id })}
                      />
                      <ProfileAssignSelect
                        label="Profil par défaut : SÉRIES"
                        value={qualityAssignments.tv_profile_id}
                        profiles={qualityProfiles}
                        onChange={(id) => setQualityAssignments({ ...qualityAssignments, tv_profile_id: id })}
                      />
                      <ProfileAssignSelect
                        label="Profil par défaut : ANIME"
                        value={qualityAssignments.anime_profile_id}
                        profiles={qualityProfiles}
                        emptyLabel="Aucun profil (repli Séries)"
                        onChange={(id) => setQualityAssignments({ ...qualityAssignments, anime_profile_id: id })}
                      />
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

      {activeTab === 'system' && (
        <div className="animate-premium-fade space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-4">
              <Database className="text-green-500" size={24} />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Système & Santé</h2>
            </div>
            <button
              type="button"
              onClick={refreshSystemHealth}
              disabled={isHealthLoading}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isHealthLoading ? 'animate-spin' : ''} />
              Tester maintenant
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['prowlarr', 'tmdb', 'emby', 'db'] as const).map((service) => {
              const status = systemHealth?.[service];
              const ok = Boolean(status?.ok);
              const labels: Record<string, string> = {
                prowlarr: 'Prowlarr',
                tmdb: 'TMDB',
                emby: 'Emby',
                db: 'SQLite'
              };
              return (
                <div key={service} className="glass-card p-5 border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{labels[service]}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : status ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]' : 'bg-gray-600'}`} />
                  </div>
                  <p className={`text-sm font-black uppercase tracking-tighter ${ok ? 'text-green-400' : status ? 'text-red-400' : 'text-gray-500'}`}>
                    {!status ? '—' : ok ? 'En ligne' : 'Hors ligne'}
                  </p>
                  {status?.latencyMs != null && (
                    <p className="text-[10px] text-gray-500 mt-2 font-bold">{status.latencyMs} ms</p>
                  )}
                  {status?.error && !ok && (
                    <p className="text-[10px] text-red-400/70 mt-2 line-clamp-2">{status.error}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <Activity className="text-violet-500" size={20} />
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">qBittorrent par utilisateur</h3>
            </div>

            {!systemHealth?.qbitUsers?.length ? (
              <div className="glass-card p-4 border-white/5 text-gray-500 text-xs">
                Aucun utilisateur avec URL + clé API qBittorrent configurées.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {systemHealth.qbitUsers.map((entry: any) => {
                  const ok = Boolean(entry?.ok);
                  return (
                    <div key={entry.userId} className="glass-card px-3 py-2.5 border-white/5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-black text-white uppercase tracking-tight truncate" title={entry.username}>
                          {entry.username}
                        </span>
                        <span className={`shrink-0 w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${ok ? 'text-green-400' : 'text-red-400'}`}>
                        {ok ? 'OK' : 'KO'}
                      </p>
                      {entry.latencyMs != null && (
                        <p className="text-[9px] text-gray-500 font-bold">{entry.latencyMs} ms</p>
                      )}
                      {entry.error && !ok && (
                        <p className="text-[9px] text-red-400/70 mt-1 line-clamp-2" title={entry.error}>{entry.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card p-6 border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <HardDrive className="text-blue-500" size={20} />
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Sauvegarde SQLite</h3>
            </div>
            <p className="text-gray-500 text-sm">Télécharge une copie de la base de données actuelle (`database.sqlite`).</p>
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isBackupLoading}
              className="px-6 py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600/30 transition-all disabled:opacity-50"
            >
              {isBackupLoading ? 'Téléchargement...' : 'Télécharger la base'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="animate-premium-fade space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-4">
              <Shield className="text-violet-500" size={24} />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Historique admin</h2>
            </div>
            <button
              type="button"
              onClick={loadActivityLog}
              disabled={isActivityLoading}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isActivityLoading ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>

          {isActivityLoading && activityItems.length === 0 ? (
            <div className="py-20 text-center text-gray-500 text-sm">Chargement...</div>
          ) : activityItems.length === 0 ? (
            <div className="glass-card p-6 text-gray-500 text-sm">Aucun événement enregistré.</div>
          ) : (
            <div className="glass-card border-white/5 divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
              {activityItems.map((entry) => {
                const detailLine = formatActivityDetails(entry.details);
                return (
                  <div key={entry.id} className="px-5 py-4 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-6">
                    <div className="sm:w-48 shrink-0 space-y-0.5">
                      <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block">
                        {getActivityEventLabel(entry.event_type)}
                      </span>
                      <span className="text-[9px] text-gray-600 font-bold block truncate" title={entry.event_type}>
                        {entry.event_type}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="text-sm text-white font-bold block truncate">{entry.target_label || '—'}</span>
                      {detailLine && (
                        <span className="text-[11px] text-gray-400 font-medium block line-clamp-2" title={detailLine}>
                          {detailLine}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold shrink-0">{entry.actor_username || 'système'}</span>
                    <span className="text-[10px] text-gray-600 shrink-0 sm:text-right sm:w-36">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString('fr-FR') : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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