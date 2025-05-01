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

  return (
    <div
      className={`relative group rounded-lg overflow-hidden transition-all duration-150 ${
        isSelected ? 'bg-blue-900/30' : 'bg-gray-800 hover:bg-gray-700/80'
      }`}
      onClick={() => onSelect(torrent.hash)}
    >
      {/* Barre de progression améliorée */}
      <div 
        className={`absolute top-0 left-0 h-full transition-all duration-300 z-[1] ${getTorrentColor(torrent)}`}
        style={{
          width:
            torrent.state.includes('missingFiles') ||
            torrent.state.toLowerCase().includes('error') ||
            torrent.state.toLowerCase().includes('unknown')
              ? '100%'
              : `${(torrent.progress * 100).toFixed(1)}%`
        }}
      >
      </div>
    
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
                  onPause(torrent.hash);
                }}
                className={`p-2 hover:bg-gray-700 rounded-full hover:text-gray-300 min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center transition-all duration-150 active:scale-95 ${
                  !['pausedUP', 'pausedDL'].includes(torrent.state)
                    ? 'text-green-400'
                    : 'text-gray-400'
                }`}
                title="Mettre en pause"
              >
                <Pause className="h-5 w-5 md:h-4 md:w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResume(torrent.hash);
                }}
                className={`p-2 hover:bg-gray-700 rounded-full hover:text-gray-300 min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center transition-all duration-150 active:scale-95 ${
                  ['pausedUP', 'pausedDL'].includes(torrent.state)
                    ? 'text-green-400'
                    : 'text-gray-400'
                }`}
                title="Reprendre"
              >
                <Play className="h-5 w-5 md:h-4 md:w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(torrent.hash);
                }}
                className="p-2 hover:bg-gray-700 rounded-full text-red-400 hover:text-red-300 min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center transition-all duration-150 active:scale-95"
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

        {/* Informations du torrent - réorganisées pour mobile */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-xs sm:text-sm text-gray-400 mt-2">
          <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-4">
            <span className="bg-gray-700/50 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">{formatSize(torrent.size)}</span>
            
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="flex items-center gap-1 sm:gap-2 bg-gray-700/50 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                <span className="text-red-500">{formatSpeed(torrent.dlspeed || 0)}</span>
              </span>
              <span className="flex items-center gap-1 sm:gap-2 bg-gray-700/50 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                <span className="text-green-500">{formatSpeed(torrent.upspeed || 0)}</span>
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-4">
            <span className={`${ratioFormat.color} bg-gray-700/50 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full`}>
              R: {ratioFormat.text}
            </span>
            <span className="bg-gray-700/50 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
              {formatDate(torrent.added_on)}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-2xs sm:text-xs bg-gray-700/50 text-green-400 max-w-full overflow-hidden text-ellipsis">
              {torrent.state === 'stalledUP' ? 'En attente de pairs' : 
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
               torrent.state}
            </span>
            {torrent.tracker && (
              <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-2xs sm:text-xs bg-gray-700/50 text-blue-400 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {getTrackerName(torrent.tracker)}
              </span>
            )}
            {/* Badge de catégorie */}
            {torrent.category ? (
              <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-2xs sm:text-xs bg-purple-700/50 text-purple-300 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                📁 {torrent.category}
              </span>
            ) : (
              <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-2xs sm:text-xs bg-gray-700/50 text-gray-400 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                Sans catégorie
              </span>
            )}
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
