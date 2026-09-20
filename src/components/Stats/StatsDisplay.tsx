import React, { type ReactNode } from 'react';
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

type StatCard = {
  key: string;
  label: string;
  icon: ReactNode;
  iconWrap: string;
  value: ReactNode;
  extra?: ReactNode;
  cardClassName?: string;
};

export function StatsDisplay({ stats }: StatsDisplayProps) {
  const ratioFormat = formatRatio(stats.globalRatio);
  const [ratioValue, ratioLabel] = ratioFormat.text.split(' ');

  const cards: StatCard[] = [
    {
      key: 'dl',
      label: 'Total DL',
      icon: <ArrowDown size={12} />,
      iconWrap: 'bg-blue-500/10 rounded-lg text-blue-400',
      value: formatSize(stats.totalDownloaded),
    },
    {
      key: 'ul',
      label: 'Total UL',
      icon: <Share2 size={12} />,
      iconWrap: 'bg-green-500/10 rounded-xl text-green-400',
      value: formatSize(stats.totalUploaded),
    },
    {
      key: 'ratio',
      label: 'Ratio',
      icon: <Scale size={12} />,
      iconWrap: 'bg-violet-500/10 rounded-xl text-violet-400',
      cardClassName: 'relative overflow-hidden group',
      value: (
        <span className={ratioFormat.color}>
          {ratioValue}
          {ratioLabel && (
            <span className="hidden lg:inline text-[9px] ml-1.5 opacity-50 font-medium uppercase tracking-widest">
              {ratioLabel}
            </span>
          )}
        </span>
      ),
      extra: (
        <div
          className={`absolute -right-4 -bottom-4 w-12 lg:w-16 h-12 lg:h-16 blur-3xl opacity-10 rounded-full transition-all duration-700 group-hover:opacity-20 ${ratioFormat.color.replace('text-', 'bg-')}`}
        />
      ),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-0">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`rounded-2xl p-3 lg:p-4 border-2 border-blue-500/25 bg-transparent flex flex-col justify-center ${card.cardClassName ?? ''}`}
        >
          <div className="flex items-center gap-1 lg:gap-2 text-blue-400/60 mb-1 lg:mb-2">
            <div className={`p-1 ${card.iconWrap}`}>{card.icon}</div>
            <span className="text-[7px] lg:text-[9px] uppercase font-black tracking-widest leading-tight">
              {card.label}
            </span>
          </div>
          <div className="text-xs lg:text-xl font-black text-white tracking-tighter truncate">
            {card.value}
          </div>
          {card.extra}
        </div>
      ))}
    </div>
  );
}
