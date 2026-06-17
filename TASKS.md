# Suivi des tâches (Search-Torrent)

Ce fichier sert de checklist. On valide chaque étape (test OK) avant de passer à la suivante.

## Règles de travail
- [ ] Avant chaque création/modification: lecture/analyse des fichiers concernés (éviter doublons)
- [ ] Après chaque étape: test local + validation

## Feature: Suivi (Films) — MVP

### Étape 1 — Backend (DB + API)
- [x] Ajouter table SQLite `library_items` dans `server/services/core/init-db.js`
  - [x] Champs: `id`, `user_id`, `tmdb_id`, `media_type`, `title`, `poster_url`, `release_date`, `monitored`, `created_at`
  - [x] Index: unique `(user_id, tmdb_id, media_type)` + index `user_id`
- [x] Créer routes `server/routes/library/index.js`
  - [x] `GET /api/library` (liste)
  - [x] `POST /api/library` (ajout)
  - [x] `DELETE /api/library/:id` (suppression)
- [x] Créer handlers `server/routes/library/handlers.js`
- [x] Monter la route dans `server/services/core/server-config.js`
  - [x] `app.use('/api/library', ...)`

### Étape 1 — Tests backend (validation)
- [x] Démarrer le serveur (`npm run dev:backend`) sans erreur
- [x] Tester `GET /api/library` (auth) → `200` + tableau
- [x] Tester `POST /api/library` avec un média TMDB → `201`
- [x] Tester `POST /api/library` doublon → `409`
- [x] Tester `DELETE /api/library/:id` → `200`

### Étape 2 — Frontend (UI)
- [x] Afficher les pochettes TMDB sur la recherche Films (`SearchPage`)
- [x] Clic sur une pochette → page `MediaDetailPage` avec résultats torrents
- [x] Ajouter bouton "Demander" sur `MediaDetailPage` (à côté de "Torrents disponibles")
- [x] Ajouter page `/library` (onglet "Demandes")
- [x] Ajouter lien "Demandes" dans `Header`
- [x] Réduire la taille des pochettes sur la page `/library`
- [x] Afficher toast ou message de confirmation après ajout

### Étape 2 — Tests frontend (validation)
- [x] Recherche film → affichage pochettes
- [x] Clic pochette → page `MediaDetailPage`
- [x] Cliquer "Demander" → média ajouté
- [x] Aller dans "Demandes" → média apparaît
- [x] Supprimer de "Demandes" → média disparaît

## Feature: Demandes (Films/Séries/Anime) — Automatisation

### Étape 3 — Backend (nouvelle table dédiée)
- [x] Créer table SQLite `media_requests` dans `server/services/core/init-db.js`
  - [x] Champs minimum: `id`, `user_id`, `tmdb_id`, `media_type`, `title`, `poster_url`, `release_date`, `status`, `created_at`
  - [x] Champs suivi: `last_checked_at`, `last_error`, `matched_torrent_name`, `matched_torrent_magnet`, `matched_torrent_size`, `matched_torrent_seeds`
  - [x] Index: unique `(user_id, tmdb_id, media_type)` + index `user_id`
- [x] Migration `library_items` -> `media_requests`
- [x] Brancher l'API actuelle `/api/library` sur cette table (sans casser le front)
- [x] Tests: ajout/liste/suppression OK après migration

### Étape 4 — Backend (recherche manuelle Prowlarr)
- [x] `POST /api/library/:id/search` → lance une recherche Prowlarr pour la demande
- [x] Mettre à jour `status`, `last_checked_at`, `matched_*`, `last_error`
- [x] Tests: demande → search → status `found` (ou `pending`/`error`)

### Étape 4b — Backend (sélection manuelle)
- [x] `POST /api/library/:id/select` → enregistre le torrent choisi (`matched_*`) et met `status=found`

### Étape 5 — Backend (envoi qBittorrent)
- [x] `POST /api/library/:id/send-to-qbit` (manuel)
- [x] Mettre à jour `status` (`sent_to_qbit` / `downloading`)
- [x] Tests: demande `found` → send-to-qbit → status `sent_to_qbit`

### Étape 7 — Frontend (Demandes)
- [ ] Clic sur une demande → page détail `/library/:id`
- [ ] Page détail: poster + statut + infos (last_checked_at, last_error, torrent sélectionné)
- [ ] Bouton "Rechercher" → ouvre une modal de résultats
- [ ] Modal: liste résultats + tri (taille / date) + bouton "Sélectionner"
- [ ] Bouton "Envoyer à qBittorrent" (visible/activé si `status=found`)

### Étape 6 — Backend (scheduler)
- [ ] Job périodique: relancer `search` sur les demandes `pending`
- [ ] Option: auto `send-to-qbit` si `found`

## Plus tard
- [ ] Support séries + modal saisons
- [ ] Automatisation (scheduler) toutes les X minutes

## Feature: Suivi (Séries/Anime) — Saisons + Épisodes (hebdo)

### Étape 8 — Backend (DB)
- [ ] Créer table SQLite `tv_season_requests` dans `server/services/core/init-db.js`
  - [ ] Champs minimum: `id`, `user_id` (créateur), `tmdb_id`, `media_type`, `title`, `poster_url`, `season_number`, `status`, `created_at`
  - [ ] Champs suivi: `next_episode_number`, `last_checked_at`, `last_error`, `matched_torrent_name`, `matched_torrent_magnet`, `matched_torrent_size`, `matched_torrent_seeds`
  - [ ] Index: unique `(tmdb_id, media_type, season_number)`

### Étape 9 — Backend (API)
- [ ] `POST /api/library/tv` → créer une demande de suivi par saison (multi-saisons)
- [ ] `GET /api/library/tv` → liste des suivis séries/anime
- [ ] `DELETE /api/library/tv/:id` → suppression (admin ou créateur)
- [ ] `POST /api/library/tv/:id/search` → recherche Prowlarr (épisode SxxEyy + fallback pack saison)
- [ ] `POST /api/library/tv/:id/select` → enregistrer le torrent choisi
- [ ] `POST /api/library/tv/:id/send-to-qbit` → envoi qBittorrent (admin ou créateur)

### Étape 10 — Frontend (UI)
- [ ] Clic "Demander" sur série/anime → modal choix saisons (checkbox) via infos TMDB
- [ ] Confirmation → création des suivis (toast succès + déjà demandé)
- [ ] Liste des suivis séries/anime (avec statut + saison + demandé par)

### Étape 11 — Backend (scheduler)
- [ ] Job périodique: relancer `search` sur les suivis `monitoring` (prochain épisode)
- [ ] Règle: épisode par épisode + fallback pack saison si "complete"

### Étape 12 — Tests (validation)
- [ ] Ajouter suivi série/anime + saisons multiples
- [ ] Doublon saison → `409` + message "Déjà demandé"
- [ ] Auto-search: épisode non diffusé → aucune action
- [ ] Auto-search: épisode diffusé → recherche + sélection + envoi
- [ ] Fallback pack saison (si complet) → download pack + fin de saison

## Bugs corrigés
- [x] qBittorrent: éviter crash "Invalid URL" si `qbit_url` contient des espaces (trim côté backend)
