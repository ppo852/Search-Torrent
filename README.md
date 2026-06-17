# Search-Torrent

![Accueil](./screenshots/acceuil.png)

Interface web moderne pour rechercher, suivre et télécharger vos médias via **Prowlarr** et **qBittorrent**.

[![Docker Hub](https://img.shields.io/badge/Docker-ppo852%2Fsearch--torrent-blue?logo=docker)](https://hub.docker.com/r/ppo852/search-torrent)
![Version](https://img.shields.io/badge/version-1.6.3-blue)

## Fonctionnalités

- **Accueil immersif** — Tendances TMDB, flux RSS récents, navigation rapide
- **Recherche multi-catégories** — Films, séries et anime via TMDB ; musique, logiciels/jeux et livres en recherche directe Prowlarr
- **Demandes & suivi** — Saisons, épisodes, auto-search intelligent
- **qBittorrent intégré** — Gestion des torrents, catégories normalisées (Films, Séries, Anime, Musique, Logiciels, Jeux, Livres…)
- **Flux RSS** — Cache optimisé, enrichissement TMDB, catégories détectées automatiquement
- **Administration** — Utilisateurs, configuration Prowlarr/qBit/TMDB, profils qualité, flux RSS
- **Sécurité** — JWT, bcrypt, secrets via variables d'environnement uniquement
- **Docker ready** — Image légère, base SQLite persistante hors image

## Installation Docker

### Prérequis

- [Prowlarr](https://github.com/Prowlarr/Prowlarr) installé et configuré
- [qBittorrent](https://www.qbittorrent.org/) avec WebUI activée
- Docker et Docker Compose

### Déploiement rapide

1. Créez votre fichier `docker-compose.yml` :

```yaml
services:
  search-torrent:
    image: ppo852/search-torrent:1.6.3
    container_name: search-torrent
    ports:
      - "4000:80"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - JWT_SECRET=changez_moi_avec_une_longue_chaine_aleatoire
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=changez_moi
      - LOG_LEVEL=info
    restart: unless-stopped
```

2. Lancez l'application :

```bash
docker compose up -d
```

3. Accédez à `http://localhost:4000` — identifiants = `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

> La base SQLite est stockée dans `./data` (volume monté). Elle n'est **pas** incluse dans l'image Docker Hub.

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `JWT_SECRET` | Clé secrète JWT (**obligatoire** en production) | — |
| `ADMIN_USERNAME` | Identifiant admin au premier démarrage | `admin` |
| `ADMIN_PASSWORD` | Mot de passe admin au premier démarrage | `admin` |
| `LOG_LEVEL` | Niveau de logs : `debug`, `info`, `warn`, `error` | `info` |
| `AUTO_SEARCH_ON_CREATE` | Lance une recherche dès l'ajout d'une demande | `true` |

## Captures d'écran

### Accueil
![Accueil](./screenshots/acceuil.png)

### Recherche & RSS
![Recherche](./screenshots/recherche.png)

### Demandes
![Demandes](./screenshots/Demande.png)

### Torrents (qBittorrent)
![Torrents](./screenshots/torrents.png)

### Administration
![Administration](./screenshots/admin.png)

### Connexion
![Connexion](./screenshots/login.png)

## Stack technique

- **Frontend** — React 18, Vite, Tailwind CSS, Zustand, React Query
- **Backend** — Node.js, Express, SQLite (better-sqlite3)
- **Intégrations** — Prowlarr, qBittorrent, TMDB

## Notes de version

### v1.6.3
- Recherche Prowlarr par catégorie : musique, logiciels (+ jeux), livres
- Normalisation des catégories qBittorrent (`shared/qbit-categories.json`)
- Corrections affichage et envoi des catégories logiciels

### v1.6.x
- Nouvelle sidebar avec stats système (stockage, réseau)
- SearchBar repensée, libellés RSS mis à jour
- Corrections recherche interactive et API

### v1.4.x — bases
- Logging centralisé, audit sécurité, UX saisons 2.0
- `.dockerignore` optimisé (exclusion de `data/`, secrets, etc.)

## Sauvegarde

Toutes vos données sont dans le dossier `./data`. Pensez à le sauvegarder régulièrement.

## Licence

<<<<<<< HEAD
Ce projet est destiné à un usage personnel. Assurez-vous de respecter les droits d'auteur et les règles de vos indexeurs.
=======
## 📝 Notes de version v1.3.0

### 🎨 Nouvelle Interface
- ✨ **Nouvelle page d'accueil style Riven** avec hero section immersive
- 🎬 Affichage des **films et séries tendance** en scroll horizontal
- 🔄 **Boutons de navigation** (flèches gauche/droite) pour défiler facilement les sections
- 📊 **80 médias affichés** au lieu de 40 pour plus de contenu
- 🎯 Design moderne avec effets glassmorphism et animations fluides

### 🔧 Refactoring & Optimisations
- ♻️ **Composants réutilisables** : MediaCard et MediaSection
- 🧹 **Code dupliqué éliminé** : -200 lignes (-58% de réduction)
- 📦 **Fonction formatYear centralisée** dans utils/formatters.ts
- 🗑️ **Suppression de la page Sorties** (doublon avec la nouvelle page d'accueil)
- 🎯 Architecture plus maintenable et évolutive

### 🚀 Backend
- 🆕 **Nouvel endpoint `/api/tmdb/newest`** : combine films now_playing et séries trending
- ⚡ **Cache TMDB optimisé** : 1 heure avec invalidation intelligente
- 🔒 **Sécurité JWT maintenue** et renforcée
- 📈 **Performance améliorée** : filtrage et entrelacement des résultats

### 📱 Navigation Simplifiée
- 🏠 **Accueil** : Nouveautés TMDB style Riven (films + séries tendance)
- 🔍 **Recherche** : Flux RSS et torrents (ancienne page d'accueil renommée)
- 📚 **Demandes** : Bibliothèque de demandes médias
- ⚙️ **qBittorrent** : Gestion des torrents
- 👤 **Admin** : Panneau d'administration

### 🐛 Corrections
- ✅ Analyse complète du code : 0 duplication, 0 code fantôme
- ✅ Validation croisée par 2 IA pour garantir la qualité
- ✅ Production ready avec Docker multi-stage optimisé

---

## 📝 Notes de version v1.2

### Nouveautés
- Réorganisation complète de l'arborescence des fichiers pour une meilleure maintenabilité
- Ajout de la catégorisation automatique selon le type de fichier téléchargé
- Refonte de l'interface pour une utilisation optimale sur petits écrans (responsive mobile)

### Améliorations
- Préparation complète à la mise en production (sécurité, logs, typage, Docker)
- Correction de bugs mineurs dans les composants de recherche
- Optimisation de la configuration Docker et instructions d'installation
- Renforcement des bonnes pratiques de sécurité (changement du mot de passe admin, gestion des secrets)

---

## 📝 Notes de version v1.1

### Nouvelles fonctionnalités
- Interface de gestion des torrents améliorée
- Nouveau design plus moderne et intuitif
- Gestion centralisée des paramètres qBittorrent par l'administrateur
- Intégration avec Prowlarr pour la recherche de torrents
- Support multi-utilisateurs avec rôles admin/utilisateur
- Gestion des flux RSS Prowlarr

### Corrections et améliorations
- Optimisation de la stabilité du cache RSS
- Amélioration des performances de recherche
- Interface responsive et adaptative
- Meilleure gestion des erreurs
- Sécurisation des données sensibles
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
