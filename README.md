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

### Déploiement production (Docker Hub)

Le dépôt inclut un `docker-compose.yml` générique prêt à l'emploi :

```bash
docker compose pull
docker compose up -d
```

Accédez à `http://localhost:4000` — identifiants = `ADMIN_USERNAME` / `ADMIN_PASSWORD` (voir variables ci-dessous).

> La base SQLite est dans `./data` (volume monté). Elle n'est **pas** incluse dans l'image Docker Hub.

### Développement local (build depuis les sources)

Pour builder l'image localement avec votre propre config (ports, chemins, secrets) :

```bash
cp docker-compose.dev.yml.example docker-compose.dev.yml
# Éditez docker-compose.dev.yml selon votre machine
docker compose -f docker-compose.dev.yml up -d --build
```

> `docker-compose.dev.yml` est **gitignoré** : vos chemins personnels ne partent pas sur GitHub.

## Configuration qBittorrent

Pour que Search-Torrent envoie correctement les catégories (`Films`, `Séries`, `Anime`, etc.) et que les fichiers aillent dans le bon dossier :

### 1. Interface Web

**Paramètres → Interface Web**

- Activer l'**interface Web distante**
- Noter l'URL, l'utilisateur et le mot de passe
- Les renseigner dans Search-Torrent (paramètres utilisateur)

### 2. Gestion automatique des torrents

**Paramètres → Téléchargements**

- **Mode de gestion de torrent par défaut** → **Automatique**
- **Lorsque la catégorie du torrent change** → **Déplacer le torrent**

Ces deux réglages sont le minimum pour que Search-Torrent puisse assigner une catégorie (`Films`, `Séries`, `Anime`, etc.) et que qBittorrent range le torrent au bon endroit.

### 3. Catégories — création automatique

**Vous n'avez pas besoin de créer les catégories à la main.** Quand Search-Torrent envoie un torrent avec une catégorie, qBittorrent la **crée automatiquement** si elle n'existe pas encore (`Films`, `Séries`, `Anime`, `Musique`, `Logiciels`, `Jeux`, `Livres`, `Autres`…).

> **Optionnel** — si vous voulez un dossier spécifique par catégorie dès le départ, vous pouvez définir le chemin de sauvegarde après coup : clic droit sur la catégorie dans qBittorrent → **Définir le chemin de sauvegarde**. Sinon, qBittorrent utilise le dossier de téléchargement par défaut + sous-dossier de la catégorie.

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

Ce projet est destiné à un usage personnel. Assurez-vous de respecter les droits d'auteur et les règles de vos indexeurs.
