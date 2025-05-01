import React, { useState, useCallback } from 'react';
import { ArrowLeft, X, Upload, AlertCircle } from 'lucide-react';
import { useGlobalDragAndDrop } from '../hooks/useGlobalDragAndDrop';
// Assure la présence de JSX types
import type {} from 'react/jsx-runtime';

interface TorrentFile {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'adding' | 'added' | 'error';
  error?: string;
  file: File;
}

export function AddTorrentPage() {
  const [torrentFiles, setTorrentFiles] = useState<TorrentFile[]>([]);
  // Utilise le hook global drag & drop
  const handleFiles = useCallback((files: File[]) => {
    const newFiles = files
      .filter((file: File) => file.name.endsWith('.torrent'))
      .map((file: File) => ({
        id: Math.random().toString(36).slice(2),
        name: file.name,
        size: file.size,
        status: 'pending' as const,
        file
      }));
    setTorrentFiles((prev: TorrentFile[]) => [...prev, ...newFiles]);
  }, []);

  const { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useGlobalDragAndDrop(handleFiles);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const removeTorrent = (id: string) => {
    setTorrentFiles((prev: TorrentFile[]) => prev.filter((f: TorrentFile) => f.id !== id));
  };

  const addTorrents = async () => {
    for (const torrent of torrentFiles) {
      if (torrent.status !== 'pending') continue;

      try {
        // Mettre à jour le statut en "adding"
        setTorrentFiles((prev: TorrentFile[]) => 
          prev.map((f: TorrentFile) => f.id === torrent.id ? { ...f, status: 'adding' } : f)
        );

        const formData = new FormData();
        formData.append('fileselect', torrent.file);

        const response = await fetch('/api/qbittorrent/add', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Erreur lors de l\'ajout du torrent');
        }

        // Mettre à jour le statut en "added"
        setTorrentFiles((prev: TorrentFile[]) => 
          prev.map((f: TorrentFile) => f.id === torrent.id ? { ...f, status: 'added' } : f)
        );
      } catch (error: any) {
        // Mettre à jour le statut en "error"
        setTorrentFiles((prev: TorrentFile[]) => 
          prev.map((f: TorrentFile) => f.id === torrent.id ? { ...f, status: 'error', error: error?.message || String(error) } : f)
        );
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div 
      className="min-h-screen bg-gray-900 text-white relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Zone de drop qui apparaît quand on glisse un fichier */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Déposez vos fichiers torrent</h3>
            <p className="text-gray-400">Les fichiers seront ajoutés à qBittorrent</p>
          </div>
        </div>
      )}

      <div className="container mx-auto p-4">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="p-2 hover:bg-gray-800 rounded-lg"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-semibold">Ajouter des torrents</h1>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".torrent"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="torrent-input"
            />
            <label 
              htmlFor="torrent-input"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer flex items-center gap-2"
            >
              <Upload className="h-5 w-5" />
              Sélectionner
            </label>
            {torrentFiles.length > 0 && (
              <button
                onClick={addTorrents}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <Upload className="h-5 w-5" />
                Ajouter {torrentFiles.length} torrent{torrentFiles.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* Liste des fichiers */}
        {torrentFiles.length > 0 ? (
          <div className="space-y-2">
            {torrentFiles.map((file: TorrentFile) => (
              <div 
                key={file.id} 
                className={`bg-gray-800 rounded-lg p-4 flex items-center justify-between ${
                  file.status === 'error' ? 'border border-red-500/50' :
                  file.status === 'added' ? 'border border-green-500/50' :
                  file.status === 'adding' ? 'border border-blue-500/50' :
                  ''
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  {file.status === 'error' ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : file.status === 'added' ? (
                    <Upload className="h-5 w-5 text-green-500" />
                  ) : file.status === 'adding' ? (
                    <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      <span>{formatFileSize(file.size)}</span>
                      {file.error && (
                        <>
                          <span>•</span>
                          <span className="text-red-400">{file.error}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => removeTorrent(file.id)}
                  className="p-1.5 hover:bg-gray-700 rounded-lg"
                  title="Retirer"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">Déposez vos fichiers torrent ici</h3>
            <p className="text-gray-500">ou utilisez le bouton "Sélectionner"</p>
          </div>
        )}
      </div>
    </div>
  );
}
