import React, { useState, useEffect } from 'react';
import { X, Save, Shield, HardDrive, Key, Folder, CheckCircle, AlertCircle, Server, Globe, User, Lock, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface UserData {
  id: string;
  username: string;
  is_admin: boolean;
  qbit_url?: string;
  qbit_username?: string;
  qbit_password?: string;
  download_path_movies?: string;
  download_path_series?: string;
  download_path_anime?: string;
  allow_force_interactive_download?: boolean;
}

interface UserSettingsModalProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser?: UserData) => void;
}

type TabType = 'qbit' | 'media' | 'security';

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ user, isOpen, onClose, onUserUpdated }) => {
  const currentAdmin = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabType>('qbit');
  const [settings, setSettings] = useState({
    qbit_url: '',
    qbit_username: '',
    qbit_password: '',
    download_path_movies: '',
    download_path_series: '',
    download_path_anime: '',
    allow_force_interactive_download: false,
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      setSettings({
        qbit_url: user.qbit_url || '',
        qbit_username: user.qbit_username || '',
        qbit_password: user.qbit_password || '',
        download_path_movies: user.download_path_movies || '',
        download_path_series: user.download_path_series || '',
        download_path_anime: user.download_path_anime || '',
        allow_force_interactive_download: !!user.allow_force_interactive_download,
      });
      setNewPassword('');
      setConfirmPassword('');
      setMessage(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const updates: any = { ...settings };

      // Ne pas écraser le mot de passe qBittorrent si le champ est laissé vide
      if (!updates.qbit_password?.trim()) {
        delete updates.qbit_password;
      }

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas');
        }
        updates.password = newPassword;
      }

      const updatedUser = await api.updateUser(user.id, updates);
      setMessage({ type: 'success', text: 'Paramètres enregistrés avec succès' });
      onUserUpdated({
        ...user,
        ...updatedUser,
        allow_force_interactive_download: !!updatedUser?.allow_force_interactive_download,
      });

      if (user.id === currentAdmin?.id) {
        useAuthStore.getState().patchUser({
          allow_force_interactive_download: !!updatedUser?.allow_force_interactive_download,
          qbit_url: updatedUser.qbit_url,
          qbit_username: updatedUser.qbit_username,
        });
      }
      
      if (newPassword) {
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'qbit' as const, label: 'CLIENT TORRENT', icon: HardDrive },
    { id: 'media' as const, label: 'DOSSIERS MÉDIAS', icon: Folder },
    { id: 'security' as const, label: 'SÉCURITÉ', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-premium-fade">
      <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="glass-card relative w-full max-w-2xl overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-white/10">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-black text-xl">
               {user.username.substring(0,1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Réglages de {user.username}</h2>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{user.is_admin ? 'ADMINISTRATEUR' : 'MEMBRE'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 transition-all hover:rotate-90">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row min-h-[450px]">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-56 bg-black/20 border-r border-white/5 p-4 flex md:flex-col gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-black text-[10px] tracking-widest ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-8 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {message && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 animate-premium-fade ${
                message.type === 'error' ? 'bg-red-600/10 border-red-600/20 text-red-400' : 'bg-green-600/10 border-green-600/20 text-green-400'
              }`}>
                {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                <span className="text-[10px] font-black uppercase tracking-widest">{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {activeTab === 'qbit' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-4 bg-blue-600/5 border border-blue-500/10 rounded-2xl mb-6">
                    <p className="text-[10px] font-bold text-blue-400 leading-relaxed uppercase">
                      Configuration qBittorrent spécifique à l'utilisateur.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL qBittorrent</label>
                    <div className="relative">
                      <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                      <input 
                        type="text" 
                        value={settings.qbit_url} 
                        onChange={(e) => setSettings({ ...settings, qbit_url: e.target.value })} 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-blue-500/40 transition-all" 
                        placeholder="http://192.168.1.50:8080" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Utilisateur</label>
                      <div className="relative">
                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input 
                          type="text" 
                          value={settings.qbit_username} 
                          onChange={(e) => setSettings({ ...settings, qbit_username: e.target.value })} 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-blue-500/40 transition-all" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mot de passe</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input 
                          type="password" 
                          value={settings.qbit_password} 
                          onChange={(e) => setSettings({ ...settings, qbit_password: e.target.value })} 
                          placeholder="Laisser vide pour conserver l'actuel"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-gray-600 placeholder:font-bold placeholder:text-[9px]" 
                        />
                      </div>
                    </div>
                  </div>

                  {currentAdmin?.is_admin && (
                    <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                      <input
                        type="checkbox"
                        checked={settings.allow_force_interactive_download}
                        onChange={(e) =>
                          setSettings({ ...settings, allow_force_interactive_download: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500/40"
                      />
                      <div className="space-y-1">
                        <span className="block text-[10px] font-black text-white uppercase tracking-widest">
                          Autoriser le forçage des téléchargements
                        </span>
                        <span className="block text-[9px] font-bold text-gray-500 leading-relaxed">
                          Si un média est déjà en médiathèque, l&apos;utilisateur pourra confirmer un second téléchargement interactif (ex. version plus légère).
                        </span>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {activeTab === 'media' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-4 bg-blue-600/5 border border-blue-500/10 rounded-2xl mb-6">
                    <p className="text-[10px] font-bold text-blue-400 leading-relaxed uppercase">
                      Définissez les chemins de stockage pour cet utilisateur.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Chemin Racine Films</label>
                    <div className="relative">
                      <Folder size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                      <input 
                        type="text" 
                        value={settings.download_path_movies} 
                        onChange={(e) => setSettings({ ...settings, download_path_movies: e.target.value })} 
                        placeholder="ex: /media/user/Films"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-blue-500/40 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Chemin Racine Séries</label>
                    <div className="relative">
                      <Folder size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                      <input 
                        type="text" 
                        value={settings.download_path_series} 
                        onChange={(e) => setSettings({ ...settings, download_path_series: e.target.value })} 
                        placeholder="ex: /media/user/Series"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-blue-500/40 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Chemin Racine Anime</label>
                    <div className="relative">
                      <Folder size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                      <input 
                        type="text" 
                        value={settings.download_path_anime} 
                        onChange={(e) => setSettings({ ...settings, download_path_anime: e.target.value })} 
                        placeholder="ex: /media/user/Anime"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white text-xs font-black tracking-widest focus:ring-2 focus:ring-pink-500/40 transition-all" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nouveau Mot de Passe</label>
                    <div className="relative">
                      <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                      <input 
                        type="password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        placeholder="Laisser vide pour ne pas changer"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white focus:ring-2 focus:ring-blue-500/40 transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirmation</label>
                    <div className="relative">
                      <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                      <input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white focus:ring-2 focus:ring-blue-500/40 transition-all" 
                      />
                    </div>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSaving} 
                className="w-full py-4 premium-gradient text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isSaving ? 'ENREGISTREMENT...' : 'ENREGISTRER LES MODIFICATIONS'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};