import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import {
  listLibraryHandler,
  createLibraryItemHandler,
  deleteLibraryItemHandler,
  searchLibraryItemHandler,
  autoSearchLibraryItemHandler,
  sendToQbitLibraryItemHandler,
  selectLibraryItemHandler,
  listTvSeasonRequestsHandler,
  createTvSeasonRequestsHandler,
  deleteTvSeasonRequestHandler,
  searchTvSeasonRequestHandler,
  searchTvSeasonRequestEpisodeHandler,
  autoSearchTvSeasonRequestHandler,
  autoSearchTvSeasonEpisodeRequestHandler,
  selectTvSeasonRequestHandler,
  sendToQbitTvSeasonRequestHandler,
  getTvSeasonPresenceHandler,
<<<<<<< HEAD
  getTvSeasonHistoryHandler,
  getExistingSeasonsHandler
=======
  getTvSeasonHistoryHandler
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
} from './handlers.js';

const router = express.Router();

router.get('/tv', authenticateToken, listTvSeasonRequestsHandler);
router.post('/tv', authenticateToken, createTvSeasonRequestsHandler);
<<<<<<< HEAD
router.get('/tv/check/:tmdbId', authenticateToken, getExistingSeasonsHandler);
=======
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
router.post('/tv/:id/search', authenticateToken, searchTvSeasonRequestHandler);
router.post('/tv/:id/search-episode', authenticateToken, searchTvSeasonRequestEpisodeHandler);
router.post('/tv/:id/auto-search', authenticateToken, autoSearchTvSeasonRequestHandler);
router.post('/tv/:id/auto-search-episode', authenticateToken, autoSearchTvSeasonEpisodeRequestHandler);
router.post('/tv/:id/select', authenticateToken, selectTvSeasonRequestHandler);
router.post('/tv/:id/send-to-qbit', authenticateToken, sendToQbitTvSeasonRequestHandler);
router.get('/tv/:id/presence', authenticateToken, getTvSeasonPresenceHandler);
router.get('/tv/:id/history', authenticateToken, getTvSeasonHistoryHandler);
router.delete('/tv/:id', authenticateToken, deleteTvSeasonRequestHandler);

router.get('/', authenticateToken, listLibraryHandler);
router.post('/', authenticateToken, createLibraryItemHandler);
router.post('/:id/search', authenticateToken, searchLibraryItemHandler);
router.post('/:id/auto-search', authenticateToken, autoSearchLibraryItemHandler);
router.post('/:id/select', authenticateToken, selectLibraryItemHandler);
router.post('/:id/send-to-qbit', authenticateToken, sendToQbitLibraryItemHandler);
router.delete('/:id', authenticateToken, deleteLibraryItemHandler);

export default router;