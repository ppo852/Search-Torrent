import React from 'react';
import { Torrent } from '../../../types/qbittorrent';
import { Trash2, ArrowDown, ArrowUp, Pause, Play } from 'lucide-react';
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

  const stateLabel =
    torrent.state === 'stalledUP' ? 'En attente de pairs' :
    torrent.state === 'forcedUP' ? 'Partage forcé' :
    torrent.state === 'uploading' ? 'En partage' :
    torrent.state === 'downloading' ? 'En téléchargement' :
    torrent.state === 'stalledDL' ? 'Téléchargement en attente' :
    torrent.state === 'pausedDL' ? 'En pause' :
    torrent.state === 'pausedUP' ? 'Partage en pause' :
    torrent.state === 'queuedUP' ? 'En file d\'attente (partage)' :
    torrent.state === 'queuedDL' ? 'En file d\'attente' :
    torrent.state === 'error' ? 'Erreur' :
    torrent.state === 'missingFiles' ? 'Fichiers manquants' :
    torrent.state;

  const isPaused = ['pausedUP', 'pausedDL', 'stoppedUP', 'stoppedDL'].includes(torrent.state);

  const formatEta = (seconds?: number | null) => {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s <= 0) return '—';
    const total = Math.floor(s);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return `${minutes}m`;
  };

  return (
    <div
      className={`relative group rounded-lg overflow-hidden transition-all duration-150 ${
        isSelected ? 'bg-blue-900/30' : 'bg-gray-800 hover:bg-gray-700/80'
      }`}
      onClick={() => onSelect(torrent.hash)}
    >
      <div className={`relative group transition-all z-[2] p-3 sm:p-4 ${isSelected ? 'pl-10 sm:pl-14' : 'pl-3 sm:pl-4 group-hover:pl-10 sm:group-hover:pl-14'}`}>
        {/* Sélection */}
        <div className={`absolute top-0 left-0 h-full flex items-center pl-2 sm:pl-4 transition-all duration-300 z-20 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div 
            className={`w-6 h-6 md:w-5 md:h-5 rounded border-2 flex items-center justify-center ${
              isSelected 
                ? 'border-blue-500 bg-blue-500' 
                : 'border-gray-500 hover:border-gray-400'
            }`}
          >
            {isSelected && <Check className="h-4 w-4 md:h-3 md:w-3 text-white" />}
          </div>
        </div>
      
      {/* En-tête du torrent avec indicateur de pourcentage */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-base sm:text-lg truncate max-w-[calc(100%-110px)] sm:max-w-[calc(100%-120px)] md:max-w-[calc(100%-150px)]" title={torrent.name}>
            {torrent.name}
            <span className="ml-2 hidden md:inline-flex text-xs bg-gray-700/50 text-gray-200 px-2 py-0.5 rounded-full">
              {stateLabel}
            </span>
            {(torrent.state === 'downloading' || torrent.state === 'stalledDL') && torrent.progress < 1 && (
              <span className="ml-1 sm:ml-2 text-xs sm:text-sm bg-blue-500/20 text-blue-300 px-1.5 sm:px-2 py-0.5 rounded-full animate-pulse">
                {(torrent.progress * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isPaused ? onResume(torrent.hash) : onPause(torrent.hash);
                }}
                className={`p-2 hover:bg-gray-700 rounded-full hover:text-gray-300 min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center transition-all duration-150 active:scale-95 ${
                  isPaused ? 'text-green-400' : 'text-green-400'
                }`}
                title={isPaused ? 'Reprendre' : 'Mettre en pause'}
              >
                {isPaused ? (
                  <Play className="h-5 w-5 md:h-4 md:w-4" />
                ) : (
                  <Pause className="h-5 w-5 md:h-4 md:w-4" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(torrent.hash);
                }}
                className="hidden md:flex p-2 hover:bg-gray-700 rounded-full text-red-400 hover:text-red-300 min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center transition-all duration-150 active:scale-95"
                title="Supprimer"
              >
                <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
              </button>
            </div>
            {/* Menu contextuel */}
            <TorrentContextMenu 
              hash={torrent.hash} 
              state={torrent.state}
              onAction={fetchTorrents}
            />
          </div>
        </div>

        <div className="md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-200 bg-gray-700/50 px-2 py-0.5 rounded-full truncate max-w-[60%]">
              {stateLabel}
            </div>
            <div className="text-xs text-gray-300 flex items-center gap-2">
              <span>{(torrent.progress * 100).toFixed(1)}%</span>
              <span>•</span>
              <span>{formatSize(torrent.size)}</span>
              <span>•</span>
              <span>{formatEta((torrent as any).eta)}</span>
            </div>
          </div>

          {torrent.tracker && (
            <div className="mt-1 text-[10px] text-gray-300 truncate">
              {getTrackerName(torrent.tracker)}
            </div>
          )}

          <div className="mt-2 h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full ${getTorrentColor(torrent)}`}
              style={{ width: `${Math.max(0, Math.min(100, torrent.progress * 100))}%` }}
            />
          </div>
        </div>

        {/* Informations du torrent - réorganisées pour mobile */}
        <div className="hidden md:block mt-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs bg-gray-700/50 text-gray-200 px-2 py-0.5 rounded-full">
                  {stateLabel}
                </span>
                {torrent.tracker && (
                  <span className="text-xs bg-gray-700/50 text-blue-300 px-2 py-0.5 rounded-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    {getTrackerName(torrent.tracker)}
                  </span>
                )}
                {torrent.category ? (
                  <span className="text-xs bg-purple-700/40 text-purple-200 px-2 py-0.5 rounded-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    📁 {torrent.category}
                  </span>
                ) : (
                  <span className="text-xs bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-full">
                    Sans catégorie
                  </span>
                )}
                <span className="text-xs bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded-full">
                  {formatDate(torrent.added_on)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs bg-gray-900/40 border border-gray-700/60 text-gray-200 px-2 py-1 rounded-full">
                  {formatSize(torrent.size)}
                </span>

                <span className="text-xs bg-gray-900/40 border border-gray-700/60 text-red-300 px-2 py-1 rounded-full inline-flex items-center gap-1">
                  <ArrowDown className="h-3.5 w-3.5 text-red-400" />
                  {formatSpeed(torrent.dlspeed || 0)}
                </span>

                <span className="text-xs bg-gray-900/40 border border-gray-700/60 text-green-300 px-2 py-1 rounded-full inline-flex items-center gap-1">
                  <ArrowUp className="h-3.5 w-3.5 text-green-400" />
                  {formatSpeed(torrent.upspeed || 0)}
                </span>

                <span className={`text-xs bg-gray-900/40 border border-gray-700/60 px-2 py-1 rounded-full ${ratioFormat.color}`}>
                  R: {ratioFormat.text}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="text-sm text-gray-200 bg-gray-700/50 px-2 py-1 rounded-full">
                {(torrent.progress * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mt-2 h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full ${getTorrentColor(torrent)}`}
              style={{ width: `${Math.max(0, Math.min(100, torrent.progress * 100))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant Check manquant dans les imports
const Check: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
