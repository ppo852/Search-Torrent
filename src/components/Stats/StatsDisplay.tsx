import React from 'react';
import { HardDrive, Share2, Scale, ArrowDown } from 'lucide-react';
import { GlobalStats } from '../../types/qbittorrent';
import { formatSize } from '../../utils/formatters';

interface StatsDisplayProps {
    stats: GlobalStats;
}

const formatRatio = (ratio: number): { text: string; color: string } => {
    const value = ratio.toFixed(3);
    if (ratio >= 1.5) return { text: `${value} Excellent`, color: 'text-green-400' };
    if (ratio >= 1) return { text: `${value} Bon`, color: 'text-green-500' };
    if (ratio >= 0.5) return { text: `${value} Moyen`, color: 'text-yellow-500' };
    return { text: `${value} Faible`, color: 'text-red-500' };
};

export function StatsDisplay({ stats }: StatsDisplayProps) {
    const ratioFormat = formatRatio(stats.globalRatio);
    
    return (
        <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <ArrowDown className="h-4 w-4" />
                    <span className="text-xs uppercase">Total téléchargé</span>
                </div>
                <div className="text-xl font-semibold">{formatSize(stats.totalDownloaded)}</div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Share2 className="h-4 w-4" />
                    <span className="text-xs uppercase">Total partagé</span>
                </div>
                <div className="text-xl font-semibold">{formatSize(stats.totalUploaded)}</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Scale className="h-4 w-4" />
                    <span className="text-xs uppercase">Ratio global</span>
                </div>
                <div className={`text-xl font-semibold ${ratioFormat.color}`}>{ratioFormat.text}</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <HardDrive className="h-4 w-4" />
                    <span className="text-xs uppercase">Espace restant</span>
                </div>
                <div className="text-xl font-semibold">{formatSize(stats.freeSpace)}</div>
            </div>
        </div>
    );
}
