import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export interface QBittorrentStats {
    totalUploaded: number;
    totalDownloaded: number;
    globalRatio: number;
    freeSpace: number;
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
    const ridRef = useRef(0);

    const fetchStats = async () => {
        try {
            const mainData = await api.getQbitMainData(ridRef.current);

            if (mainData.rid) {
                ridRef.current = mainData.rid;
            }

            const freeSpace = mainData.server_state?.free_space_on_disk || stats.freeSpace;

            if (mainData.torrents || mainData.full_update) {
                const torrents = mainData.torrents ? Object.values(mainData.torrents) : [];

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
                    setStats(prevStats => ({
                        ...prevStats,
                        freeSpace
                    }));
                }
            } else {
                setStats(prevStats => ({
                    ...prevStats,
                    freeSpace
                }));
            }

            setError('');
        } catch (err: any) {
            setError(err?.message || 'Erreur');
            ridRef.current = 0;
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
