import { useState, useEffect } from 'react';
import { Torrent } from '../types/qbittorrent';

export interface QBittorrentStats {
    totalUploaded: number;
    totalDownloaded: number;
    globalRatio: number;
    freeSpace: number;
}

// Interface pour stocker le jeton de synchronisation
interface SyncState {
    rid: number;
}

export const useQBittorrentStats = () => {
    const [stats, setStats] = useState<QBittorrentStats>({
        totalUploaded: 0,
        totalDownloaded: 0,
        globalRatio: 0,
        freeSpace: 0
    });
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [syncState, setSyncState] = useState<SyncState>({ rid: 0 });

    const fetchStats = async () => {
        try {
            // Utiliser uniquement l'API de synchronisation avec le jeton rid
            const mainDataResponse = await fetch(`/api/qbittorrent/sync/maindata?rid=${syncState.rid}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!mainDataResponse.ok) {
                throw new Error('Erreur lors de la récupération des données de synchronisation');
            }

            const mainData = await mainDataResponse.json();
            
            // Mettre à jour le jeton de synchronisation pour la prochaine requête
            if (mainData.rid) {
                setSyncState({ rid: mainData.rid });
            }
            
            // Récupérer l'espace disque
            const freeSpace = mainData.server_state?.free_space_on_disk || stats.freeSpace;
            
            // Si nous avons des torrents dans la réponse ou si c'est une mise à jour complète
            if (mainData.torrents || mainData.full_update) {
                // Calculer les statistiques à partir des torrents
                const torrents = mainData.torrents ? Object.values(mainData.torrents) : [];
                
                // Si nous avons des torrents, calculer les statistiques
                if (torrents.length > 0) {
                    const totalSize = torrents.reduce((sum: number, torrent: any) => sum + (torrent.size || 0), 0);
                    const totalUploaded = torrents.reduce((sum: number, torrent: any) => 
                        sum + ((torrent.ratio || 0) * (torrent.size || 0)), 0);
                    const totalDownloaded = torrents.reduce((sum: number, torrent: any) => sum + (torrent.size || 0), 0);
                    const globalRatio = totalSize > 0 ? totalUploaded / totalSize : 0;
                    
                    setStats({
                        totalUploaded,
                        totalDownloaded,
                        globalRatio,
                        freeSpace
                    });
                } else {
                    // Mettre à jour uniquement l'espace disque si nous n'avons pas de torrents
                    setStats(prevStats => ({
                        ...prevStats,
                        freeSpace
                    }));
                }
            } else {
                // Mettre à jour uniquement l'espace disque si nous n'avons pas de torrents dans la réponse
                setStats(prevStats => ({
                    ...prevStats,
                    freeSpace
                }));
            }
            
            setError('');
        } catch (err) {
            setError(err.message);
            
            // En cas d'erreur, réinitialiser le rid pour forcer une mise à jour complète
            setSyncState({ rid: 0 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    return { stats, error, loading };
};
