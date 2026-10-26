import { readFileSync } from 'fs';
import path from 'path';

import { FacetsController } from './controllers/facets.controller';
import { InstrumentsBatchController } from './controllers/instruments-batch.controller';
import { PopularController } from './controllers/popular.controller';
import { SearchLogController } from './controllers/search-log.controller';
import { SearchController } from './controllers/search.controller';
import { SearchIndexController } from './controllers/search-index.controller';
import { InstrumentsRepository } from './repositories/instruments-json.repository';
import { InstrumentsBatchService } from './services/instruments-batch.service';
import { FacetsService } from './services/facets.service';
import { SearchIndexService } from './services/search-index.service';
import { SearchService } from './services/search.service';
import { SearchLog } from './search-log/search-log';
import { createPersistentSearchLog } from './search-log/search-log-file';

const SEED_FILE = path.resolve(__dirname, '../data/popular-seed.json');

/**
 * This module instantiates the services which depend on the repository and the controllers which are
 * exported to main to register their routes.
 */
export interface SearchModuleResult {
  searchService: SearchService;
  searchController: SearchController;
  searchIndexController: SearchIndexController;
  instrumentsBatchController: InstrumentsBatchController;
  facetsController: FacetsController;
}

export function initSearchModule(
  instrumentsRepository: InstrumentsRepository,
): SearchModuleResult {
  const searchService: SearchService = new SearchService(instrumentsRepository);

  const facetsService: FacetsService = new FacetsService(
    instrumentsRepository,
    searchService,
  );

  return {
    searchService,
    searchController: new SearchController(searchService),
    searchIndexController: new SearchIndexController(
      new SearchIndexService(instrumentsRepository),
    ),
    instrumentsBatchController: new InstrumentsBatchController(
      new InstrumentsBatchService(instrumentsRepository),
    ),
    facetsController: new FacetsController(facetsService),
  };
}

/**
 * The search log module: the injected log (in memory), or a new one that counts results with the search
 * service and persists to `searchLogFile`, starting from data/popular-seed.json the first time.
 */
export function initSearchLogModule(
  searchService: SearchService,
  clock: () => number,
  searchLogFile: string,
  searchLog?: SearchLog,
): {
  searchLogController: SearchLogController;
  popularController: PopularController;
  flushSearchLog: () => void;
} {
  let ready = Promise.resolve();
  let flushSearchLog = () => {};
  if (!searchLog) {
    const persistent = createPersistentSearchLog({
      file: searchLogFile,
      clock,
      countFor: async (spelling) =>
        (await searchService.searchAll({ search_text: spelling })).length,
      loadSeed: () => JSON.parse(readFileSync(SEED_FILE, 'utf-8')),
    });
    searchLog = persistent.searchLog;
    ready = persistent.ready;
    flushSearchLog = persistent.flush;
  }
  return {
    searchLogController: new SearchLogController(searchLog),
    popularController: new PopularController(searchLog, ready),
    flushSearchLog,
  };
}
