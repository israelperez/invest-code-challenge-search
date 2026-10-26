import { readFileSync } from 'fs';
import path from 'path';

import { SearchLog } from '../search-log/search-log';
import { SearchLogAdminController } from './search-log-admin.controller';

const SEED_FILE = path.resolve(__dirname, '../../data/popular-seed.json');

/**
 * The search log admin module: development-only Clear and Restore demo data. Its whole surface is this folder
 * plus the registration lines in app.ts, so removing it leaves the rest untouched.
 */
export function initSearchLogAdminModule(
  searchLog: SearchLog,
  ready: Promise<void>,
  flushSearchLog: () => boolean,
): { searchLogAdminController: SearchLogAdminController } {
  return {
    searchLogAdminController: new SearchLogAdminController(
      searchLog,
      ready,
      flushSearchLog,
      () => JSON.parse(readFileSync(SEED_FILE, 'utf-8')),
    ),
  };
}
