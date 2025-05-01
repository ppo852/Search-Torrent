import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, RefreshCw, CheckCircle } from 'lucide-react';
import { api } from '../../services/api/api';

interface TorrentContextMenuProps {
  hash: string;
  onAction: () => void;
  state?: string;
}

export function TorrentContextMenu({ hash, onAction, state }: TorrentContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
      onAction(); // Rafraîchir la liste des torrents
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsOpen(false);
    }
  };

  // Calculer la position du menu
  const getMenuPosition = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX - 100 // Décalage pour aligner à droite
    };
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-gray-700 rounded-full"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div 
          className="fixed w-48 rounded-md shadow-lg bg-gray-800 border border-gray-700"
          style={{
            ...getMenuPosition(),
            zIndex: 99999
          }}
        >
          <div className="py-1" role="none">
            <button
              className="flex w-full items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              onClick={() => handleAction(() => api.reannounceTrackers(hash))}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Rafraîchir le torrent
            </button>
            <button
              className="flex w-full items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              onClick={() => handleAction(() => api.recheckTorrent(hash))}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Vérifier l'intégrité
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
