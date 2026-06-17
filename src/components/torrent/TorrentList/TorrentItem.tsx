import React from 'react';
import { Torrent } from '../../../types/qbittorrent';
import { Trash2, ArrowDown, ArrowUp, Pause, Play, Clock, Tag, HardDrive, X, Calendar } from 'lucide-react';
import { formatSize, formatSpeed, formatRatioWithColor, formatDate } from '../../../utils/formatters';
import { getTorrentColor, getTrackerName } from '../../../utils/torrentUtils';
import { TorrentContextMenu } from '../TorrentContextMenu';

interface TorrentItemProps {
  torrent: Torrent;
  isSelected: boolean;
  onSelect: (hash: string) => void;
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string) => void;
  fetchTorrents: () => void;
}

const Check: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const TorrentItem: React.FC<TorrentItemProps> = ({
  torrent,
  isSelected,
  onSelect,
  onPause,
  onResume,
  onDelete,
  fetchTorrents
}) => {
  const ratioFormat = formatRatioWithColor(torrent.ratio || 0);
  const isPaused = ['pausedUP', 'pausedDL', 'stoppedUP', 'stoppedDL'].includes(torrent.state);

  const stateLabel =
    torrent.state === 'stalledUP' ? 'En attente' :
      torrent.state === 'uploading' ? 'Partage' :
        torrent.state === 'downloading' ? 'Réception' :
          torrent.state === 'pausedDL' ? 'Pause' :
            torrent.state === 'pausedUP' ? 'Pause' :
              torrent.state === 'error' ? 'Erreur' :
                torrent.state;

  const formatEta = (seconds?: number | null) => {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s <= 0) return '∞';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div
      className={`relative group transition-all duration-300 border-l-4 cursor-pointer ${isSelected ? 'bg-blue-600/5 border-blue-500' : 'bg-transparent border-transparent hover:bg-white/5'
        }`}
      onClick={() => onSelect(torrent.hash)}
    >
      <div className="p-4 sm:p-6 relative">
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-50'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/40' : 'border-white/20'}`}>
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </div>
        </div>

        <div className={`transition-all duration-300 ${isSelected ? 'pl-10' : 'pl-0 group-hover:pl-10'}`}>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-white font-bold text-sm sm:text-base truncate tracking-tight uppercase" title={torrent.name}>{torrent.name}</h3>
                  <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${torrent.state === 'downloading' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      torrent.state === 'uploading' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                        'bg-white/5 border-white/10 text-gray-500'
                    }`}>{stateLabel}</div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><HardDrive size={12} className="text-gray-700" />{formatSize(torrent.size)}</span>
                  {torrent.progress < 1 && <span className="flex items-center gap-1.5 text-blue-400/80"><Clock size={12} />{formatEta((torrent as any).eta)}</span>}
                  {torrent.category && <span className="flex items-center gap-1.5 text-purple-400/80"><Tag size={12} />{torrent.category}</span>}
                  {(torrent.added_on && torrent.added_on > 0 && torrent.added_on < 4000000000) ? (
                    <span className="flex items-center gap-1.5 text-gray-400/80" title="Date d'ajout">
                      <Calendar size={12} className="text-gray-700" />
                      {formatDate(torrent.added_on)}
                    </span>
                  ) : (torrent.completion_on && torrent.completion_on > 0 && torrent.completion_on < 4000000000) ? (
                    <span className="flex items-center gap-1.5 text-gray-400/80" title="Date de fin">
                      <Calendar size={12} className="text-gray-700" />
                      {formatDate(torrent.completion_on)}
                    </span>
                  ) : null}
                  {/* Source (Tracker) */}
                  {torrent.tracker && (
                    <span className="flex items-center gap-1.5 text-orange-400/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                      {getTrackerName(torrent.tracker)}
                    </span>
                  )}

                  {/* Vrais Tags (on masque les st:...) */}
                  {torrent.tags && torrent.tags.trim().length > 0 && (
                    torrent.tags
                      .split(',')
                      .map(tag => tag.trim())
                      .filter(tag => tag && !tag.startsWith('st:') && tag !== 'st')
                      .map((tag, idx) => (
                        <span key={idx} className="flex items-center gap-1.5 text-blue-400/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          {tag}
                        </span>
                      ))
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => isPaused ? onResume(torrent.hash) : onPause(torrent.hash)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95">
                  {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                </button>
                <button onClick={() => onDelete(torrent.hash)} className="p-2.5 rounded-xl bg-red-600/5 hover:bg-red-600/10 text-red-400/60 hover:text-red-400 transition-all active:scale-95" title="Supprimer">
                  <Trash2 size={16} />
                </button>
                <TorrentContextMenu hash={torrent.hash} state={torrent.state} onAction={fetchTorrents} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-blue-400"><ArrowDown size={12} strokeWidth={3} /><span>{formatSpeed(torrent.dlspeed || 0)}</span></div>
                  <div className="flex items-center gap-1.5 text-green-400"><ArrowUp size={12} strokeWidth={3} /><span>{formatSpeed(torrent.upspeed || 0)}</span></div>
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  <span className={ratioFormat.color}>Ratio: {ratioFormat.text}</span>
                  <span className="text-white">{(torrent.progress * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={`absolute inset-y-0 left-0 transition-all duration-1000 ease-out ${getTorrentColor(torrent)}`} style={{ width: `${Math.max(0, Math.min(100, torrent.progress * 100))}%` }} />
                {torrent.state === 'downloading' && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
