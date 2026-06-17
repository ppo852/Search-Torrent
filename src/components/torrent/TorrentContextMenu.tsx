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

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-2.5 rounded-xl transition-all active:scale-95 ${isOpen ? 'bg-white/10 text-white' : 'bg-transparent hover:bg-white/5 text-gray-400 hover:text-white'}`}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] bg-gray-900 border border-white/10 z-[9999] overflow-hidden animate-premium-fade"
        >
          <div className="p-1.5 space-y-0.5" role="none">
            <button
              className="flex w-full items-center px-4 py-3 text-[10px] font-black tracking-widest uppercase rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all group"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAction(() => api.reannounceTrackers(hash));
              }}
            >
              <RefreshCw size={14} className="mr-3 group-hover:text-blue-400 transition-colors" />
              Rafraîchir
            </button>
            <button
              className="flex w-full items-center px-4 py-3 text-[10px] font-black tracking-widest uppercase rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all group"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAction(() => api.recheckTorrent(hash));
              }}
            >
              <CheckCircle size={14} className="mr-3 group-hover:text-green-400 transition-colors" />
              Vérification
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
