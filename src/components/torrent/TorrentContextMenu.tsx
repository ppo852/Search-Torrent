import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MoreVertical, RefreshCw, CheckCircle, Download } from 'lucide-react';
import { api } from '../../services/api/api';
import { showToast, showApiErrorToast } from '../../stores/toastStore';

const MENU_ESTIMATED_HEIGHT = 180;
const MENU_GAP = 8;

function getOverflowClipParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflow, overflowY } = getComputedStyle(node);
    if (/(auto|scroll|hidden)/.test(`${overflow}${overflowY}`)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

interface TorrentContextMenuProps {
  hash: string;
  name?: string;
  onAction: () => void;
}

export function TorrentContextMenu({ hash, name, onAction }: TorrentContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const clipParent = getOverflowClipParent(buttonRef.current);
    const bottomLimit = clipParent
      ? clipParent.getBoundingClientRect().bottom
      : window.innerHeight;
    const spaceBelow = bottomLimit - rect.bottom - MENU_GAP;
    setOpenUpward(spaceBelow < MENU_ESTIMATED_HEIGHT);
  }, [isOpen]);

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

  const handleAction = async (action: () => Promise<void>, successMsg?: string) => {
    try {
      await action();
      if (successMsg) showToast(successMsg);
      onAction();
    } catch (error: any) {
      showApiErrorToast(error, 'Action échouée');
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        title="Plus d'actions"
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
          className={`absolute right-0 w-56 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] bg-gray-900 border border-white/10 z-[9999] overflow-hidden animate-premium-fade ${
            openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="p-1.5 space-y-0.5" role="none">
            <button
              type="button"
              className="flex w-full items-center px-4 py-3 text-[10px] font-black tracking-widest uppercase rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all group"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAction(() => api.reannounceTrackers(hash), 'Trackers rafraîchis');
              }}
            >
              <RefreshCw size={14} className="mr-3 group-hover:text-blue-400 transition-colors" />
              Rafraîchir
            </button>
            <button
              type="button"
              className="flex w-full items-center px-4 py-3 text-[10px] font-black tracking-widest uppercase rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all group"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAction(() => api.recheckTorrent(hash), 'Vérification lancée');
              }}
            >
              <CheckCircle size={14} className="mr-3 group-hover:text-green-400 transition-colors" />
              Vérification
            </button>
            <button
              type="button"
              className="flex w-full items-center px-4 py-3 text-[10px] font-black tracking-widest uppercase rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all group"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAction(
                  () => api.exportTorrentFile(hash, name || hash),
                  'Fichier .torrent téléchargé'
                );
              }}
            >
              <Download size={14} className="mr-3 group-hover:text-violet-400 transition-colors" />
              Télécharger .torrent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
