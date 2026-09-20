import { Home, Search, Bookmark, Download, type LucideIcon } from 'lucide-react';

export interface NavItem {
  name: string;
  /** Libellé court pour la barre mobile (sinon `name`). */
  shortName?: string;
  href: string;
  icon: LucideIcon;
}

export const navigation: NavItem[] = [
  { name: 'DÉCOUVRIR', href: '/', icon: Home },
  { name: 'RECHERCHE', href: '/new-torrent', icon: Search },
  { name: 'DEMANDES', href: '/library', icon: Bookmark },
  { name: 'TÉLÉCHARGEMENTS', shortName: 'TÉLÉCH.', href: '/qbittorrent', icon: Download },
];

export function handleNavItemClick(href: string, resetSearch: () => void) {
  if (href === '/new-torrent' || href === '/') {
    resetSearch();
  }
}
