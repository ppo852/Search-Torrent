/**
 * Service de logging centralisé pour la production
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // info, debug, error, none
const DEBUG_MODES = {
  AUTOSEARCH: ['1', 'true', 'yes'].includes(String(process.env.DEBUG_AUTOSEARCH_ON_CREATE || '').toLowerCase()),
  WATCHER: ['1', 'true', 'yes'].includes(String(process.env.DEBUG_MEDIA_WATCHER || '').toLowerCase()),
  PROWLARR: ['1', 'true', 'yes'].includes(String(process.env.DEBUG_PROWLARR || '').toLowerCase()),
  QBIT: ['1', 'true', 'yes'].includes(String(process.env.DEBUG_QBIT || '').toLowerCase()),
  INVENTORY: ['1', 'true', 'yes'].includes(String(process.env.DEBUG_INVENTORY || '').toLowerCase())
};

export const logger = {
  info: (msg, ...args) => {
    if (['info', 'debug'].includes(LOG_LEVEL)) {
      console.log(`[INFO] ${msg}`, ...args);
    }
  },
  
  error: (msg, ...args) => {
    if (LOG_LEVEL !== 'none') {
      console.error(`[ERROR] ${msg}`, ...args);
    }
  },
  
  warn: (msg, ...args) => {
    if (LOG_LEVEL !== 'none') {
      console.warn(`[WARN] ${msg}`, ...args);
    }
  },

  debug: (tag, msg, ...args) => {
    if (LOG_LEVEL === 'debug' || DEBUG_MODES[tag.toUpperCase()]) {
      console.log(`[DEBUG][${tag}] ${msg}`, ...args);
    }
  }
};

export default logger;
