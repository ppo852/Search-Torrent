import { Home, Search, Bookmark, Download, type LucideIcon } from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export const navigation: NavItem[] = [
  { name: 'ACCUEIL', href: '/', icon: Home },
  { name: 'RECHERCHE', href: '/new-torrent', icon: Search },
  { name: 'DEMANDES', href: '/library', icon: Bookmark },
  { name: 'TORRENTS', href: '/qbittorrent', icon: Download },
];

export function handleNavItemClick(href: string, resetSearch: () => void) {
  if (href === '/new-torrent' || href === '/') {
    resetSearch();
  }
}
