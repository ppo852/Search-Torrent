import React from 'react';
import { Share2, Scale, ArrowDown } from 'lucide-react';
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
        <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-6">
            <div className="glass-card p-3 lg:p-4 border-white/5 bg-white/[0.02] flex flex-col justify-center">
                <div className="flex items-center gap-1 lg:gap-2 text-gray-500 mb-1 lg:mb-2">
                    <div className="p-1 bg-blue-500/10 rounded-lg text-blue-400">
                        <ArrowDown size={12} />
                    </div>
                    <span className="text-[7px] lg:text-[9px] uppercase font-black tracking-widest leading-tight">Total Down</span>
                </div>
                <div className="text-xs lg:text-xl font-black text-white tracking-tighter truncate">{formatSize(stats.totalDownloaded)}</div>
            </div>

            <div className="glass-card p-3 lg:p-4 border-white/5 bg-white/[0.02] flex flex-col justify-center">
                <div className="flex items-center gap-1 lg:gap-2 text-gray-500 mb-1 lg:mb-2">
                    <div className="p-1 bg-green-500/10 rounded-xl text-green-400">
                        <Share2 size={12} />
                    </div>
                    <span className="text-[7px] lg:text-[9px] uppercase font-black tracking-widest leading-tight">Total Up</span>
                </div>
                <div className="text-xs lg:text-xl font-black text-white tracking-tighter truncate">{formatSize(stats.totalUploaded)}</div>
            </div>
            
            <div className="glass-card p-3 lg:p-4 border-white/5 bg-white/[0.02] relative overflow-hidden group flex flex-col justify-center">
                <div className="flex items-center gap-1 lg:gap-2 text-gray-400 mb-1 lg:mb-2">
                    <div className="p-1 bg-violet-500/10 rounded-xl text-violet-400">
                        <Scale size={12} />
                    </div>
                    <span className="text-[7px] lg:text-[9px] uppercase font-black tracking-widest leading-tight">Ratio</span>
                </div>
                <div className={`text-xs lg:text-xl font-black tracking-tighter ${ratioFormat.color}`}>
                    {ratioFormat.text.split(' ')[0]}
                    <span className="hidden lg:inline text-[9px] ml-1.5 opacity-50 font-medium uppercase tracking-widest">{ratioFormat.text.split(' ')[1]}</span>
                </div>
                <div className={`absolute -right-4 -bottom-4 w-12 lg:w-16 h-12 lg:h-16 blur-3xl opacity-10 rounded-full transition-all duration-700 group-hover:opacity-20 ${ratioFormat.color.replace('text-', 'bg-')}`} />
            </div>
        </div>
    );
}
