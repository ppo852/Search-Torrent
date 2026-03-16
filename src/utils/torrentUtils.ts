import { Torrent } from '../types/qbittorrent';

const KNOWN_TRACKERS: Record<string, string> = {
  yggtorrent: 'YggTorrent',
  ygg: 'YggTorrent',
  yggfi: 'YggTorrent',
  'p2p-world': 'P2P-World',
  p2pworld: 'P2P-World',
  torrent911: 'Torrent911',
  torrent9: 'Torrent9',
  cpasbien: 'Cpasbien',
  rarbg: 'RARBG',
  '1337x': '1337x',
  x1337: '1337x',
  limetorrents: 'LimeTorrents',
  lime: 'LimeTorrents',
  thepiratebay: 'The Pirate Bay',
  piratebay: 'The Pirate Bay',
  tpb: 'The Pirate Bay',
  nyaa: 'Nyaa',
  anidex: 'AniDex',
  kickasstorrents: 'KAT',
  kat: 'KAT',
  eztv: 'EZTV',
  torlock: 'TorLock',
  zooqle: 'Zooqle',
  glodls: 'GloDLS',
  torrentdownloads: 'Torrent Downloads',
  torrentz2: 'Torrentz2',
  torrentz: 'Torrentz2',
  idope: 'IDope',
  btdb: 'BTDB',
  btdig: 'BTDig',
  magnetdl: 'MagnetDL',
  yourbittorrent: 'YourBittorrent',
  bittorrent: 'YourBittorrent',
  monova: 'Monova',
  seedpeer: 'SeedPeer',
  extratorrent: 'ExtraTorrent',
  ettv: 'ETTV',
  yts: 'YTS',
  yify: 'YTS',
  horriblesubs: 'HorribleSubs',
  bakabt: 'BakaBT',
  animebytes: 'AnimeBytes',
  broadcasthe: 'BroadcastheNet',
  btn: 'BroadcastheNet',
  passthe: 'PassThePopcorn',
  ptp: 'PassThePopcorn',
  redacted: 'Redacted',
  apollo: 'Apollo',
  gazelle: 'Apollo',
  whatcd: 'What.CD',
  wcd: 'What.CD',
  bibliotik: 'Bibliotik',
  myanonamouse: 'MyAnonamouse',
  mam: 'MyAnonamouse',
  torrentleech: 'TorrentLeech',
  tl: 'TorrentLeech',
  iptorrents: 'IPTorrents',
  ipt: 'IPTorrents',
  revolutiontt: 'RevolutionTT',
  rtt: 'RevolutionTT',
  filelist: 'FileList',
  fl: 'FileList',
  sceneaccess: 'SceneAccess',
  scn: 'SceneAccess',
  scc: 'SceneAccess',
  torrentday: 'TorrentDay',
  td: 'TorrentDay',
  alpharatio: 'AlphaRatio',
  ar: 'AlphaRatio',
  'hd-torrents': 'HD-Torrents',
  hdt: 'HDTime',
  'bit-hdtv': 'Bit-HDTV',
  bithdtv: 'Bit-HDTV',
  'hd-space': 'HD-Space',
  hdspace: 'HD-Space',
  xthor: 'Xthor',
  speed: 'Speed.CD',
  speedcd: 'Speed.CD',
  tehconnection: 'TEHConnection',
  tehc: 'TEHConnection',
  u2: 'U2',
  uhdbits: 'UHDBits',
  bitme: 'BitMe',
  bitmetv: 'BitMeTV',
  libble: 'Libble',
  waffles: 'Waffles',
  'waffles.fm': 'Waffles',
  what: 'What.CD',
  pandora: 'Pandora',
  pandoracdm: 'Pandora',
  'anime-ultime': 'Anime-Ultime',
  animeultime: 'Anime-Ultime',
  t411: 'T411',
  torrent411: 'T411',
  omg: 'OMGTorrent',
  omgtorrent: 'OMGTorrent',
  extremity: 'Extremity',
  extremitydl: 'Extremity',
  gktorrent: 'GKTorrent',
  freedl: 'FreeDL',
  'dl-protect': 'DL-Protect',
  dlprotect: 'DL-Protect',
  'zone-telechargement': 'Zone-Telechargement',
  zonetelechargement: 'Zone-Telechargement',
  zt: 'Zone-Telechargement',
  torrentfrancais: 'TorrentFrancais',
  'torrent-francais': 'TorrentFrancais',
  maxtorrent: 'MaxTorrent',
  t9: 'Torrent9',
  crazyhd: 'CrazyHD',
  'crazy-hd': 'CrazyHD',
  hawke: 'Hawke-Uno',
  'hawke-uno': 'Hawke-Uno',
  hawkeuno: 'Hawke-Uno',
  bluebird: 'BlueBird',
  'bluebird-hd': 'BlueBird',
  bluebirdhd: 'BlueBird',
  'm-team': 'M-Team',
  mteam: 'M-Team',
  chdbits: 'CHDBits',
  chd: 'CHDBits',
  hdchina: 'HDChina',
  hdc: 'HDChina',
  hdroad: 'HDRoad',
  ttg: 'TTG',
  totheglory: 'ToTheGlory',
  audiences: 'Audiences',
  keepfrds: 'KeepFRDS',
  open: 'Open',
  opencd: 'Open',
  ptn: 'PTN',
  pter: 'PTer',
  pterclub: 'PTer',
  hdhome: 'HDHome',
  hdh: 'HDHome',
  hdfans: 'HDFans',
  hdf: 'HDFans',
  joyhd: 'JoyHD',
  hdtime: 'HDTime',
  hdarea: 'HDArea',
  hda: 'HDArea',
  hdsky: 'HDSky',
  hds: 'HDSky',
  ourbits: 'OurBits',
  ob: 'OurBits',
  hares: 'Hares',
  dicmusic: 'DicMusic',
  dic: 'DicMusic',
  orchard: 'Orchard',
  orpheus: 'Orpheus',
  ops: 'Orpheus',
  nethd: 'NetHD',
  nhd: 'NetHD',
  ptmsg: 'PTMSG',
  msg: 'PTMSG',
  ptcc: 'PTCC',
  cc: 'PTCC',
  hdpost: 'HDPost',
  hdp: 'HDPost',
  azusa: 'Azusa',
  jpopsuki: 'Jpopsuki',
  jps: 'Jpopsuki',
  ab: 'AnimeBytes'
};

/**
 * Détermine la couleur du torrent selon son état
 * @param torrent - Objet torrent
 * @returns Classe CSS pour la couleur du torrent
 */
export const getTorrentColor = (torrent: Torrent): string => {
  // Convertir en minuscules pour toutes les vérifications
  const state = torrent.state.toLowerCase();
  
  // Priorité 1 - Autres états d'erreur
  if (state.includes('error') || state.includes('missingfiles') || state.includes('unknown')) {
    return 'bg-gradient-to-r from-red-800 to-black';
  }
  
  // Priorité 2 - États de vérification/préparation
  if (state.includes('check') || state === 'moving' || state === 'allocating') {
    return 'bg-gradient-to-r from-purple-600 to-purple-500 progress-bar-pulse';
  }
  
  // Priorité 3 - Téléchargement des métadonnées
  if (state === 'metadl') {
    return 'bg-gradient-to-r from-cyan-600 to-cyan-500 progress-bar-pulse';
  }
  
  // Priorité 4 - États de téléchargement
  if ((state === 'downloading' || state.includes('dl')) && !state.includes('paused') && !state.includes('stopped') && !state.includes('queued')) {
    return 'bg-gradient-to-r from-blue-500 to-blue-400 progress-bar-pulse';
  }
  
  // Priorité 5 - États de partage
  if (state.includes('up') && !state.includes('paused') && !state.includes('stopped') && !state.includes('queued')) {
    // Distinction visuelle entre partage actif et partage en attente
    if (state === 'uploading' || state === 'forcedup') {
      return 'bg-gradient-to-r from-[#1e81b0] to-[#1a71a0]';
    }
    return 'bg-gradient-to-r from-[#154c79] to-[#0e355a]';
  }
  
  // Priorité 6 - États de pause/arrêt
  if (state.includes('paused') || state.includes('stopped')) {
    // Distinction entre pause de téléchargement et pause de partage
    if (state.includes('dl')) {
      return 'bg-gradient-to-r from-amber-600 to-orange-500';
    }
    return 'bg-gradient-to-r from-orange-600 to-amber-500';
  }
  
  // Priorité 7 - États de file d'attente
  if (state.includes('queued')) {
    return 'bg-gradient-to-r from-gray-700 to-gray-600';
  }
  
  // Priorité 8 - Torrent complet (ne devrait être atteint que si l'état n'a pas été capturé ci-dessus)
  if (torrent.progress === 1) {
    return 'bg-gradient-to-r from-[#154c79] to-[#0e355a]';
  }
  
  // Par défaut - Autres états non reconnus
  return 'bg-gradient-to-r from-gray-800 to-gray-700';
};

/**
 * Vérifie si un torrent est en état d'erreur
 * @param torrent - Objet torrent
 * @returns true si le torrent est en erreur
 */
export const isTorrentError = (torrent: Torrent): boolean => {
  const state = torrent.state.toLowerCase();
  return state.includes('error') || state.includes('missing') || state.includes('unknown');
};

/**
 * Extrait le nom du tracker à partir de son URL
 * @param tracker - URL du tracker
 * @returns Nom du tracker
 */
export const getTrackerName = (tracker: string): string => {
  try {
    const url = new URL(tracker);
    const host = String(url.hostname || '').toLowerCase();
    const parts = host.split('.').filter(Boolean);
    const sld = parts.length >= 2 ? parts[parts.length - 2] : '';

    // 1) Prefer second-level domain exact match
    if (sld && KNOWN_TRACKERS[sld]) return KNOWN_TRACKERS[sld];

    // 2) Token match (split on dots and hyphens), avoids accidental substring matches
    const tokens = new Set(host.split(/[.\-]/g).filter(Boolean));
    for (const [key, label] of Object.entries(KNOWN_TRACKERS)) {
      if (tokens.has(key)) return label;
    }

    // 3) Fallback: show second-level domain or hostname
    if (sld) return sld;
    return host || tracker;
  } catch {
    return tracker;
  }
};
