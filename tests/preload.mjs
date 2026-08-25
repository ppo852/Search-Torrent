import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase3';

const testDir = mkdtempSync(join(tmpdir(), 'search-torrent-test-'));
process.env.DATABASE_PATH = join(testDir, 'database.sqlite');

process.env.LOG_LEVEL = 'error';
