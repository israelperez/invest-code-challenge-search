import { FacetsController } from './controllers/facets.controller';
import { InstrumentsBatchController } from './controllers/instruments-batch.controller';
import { SearchLogController } from './controllers/search-log.controller';
import { SearchController } from './controllers/search.controller';
import { SearchIndexController } from './controllers/search-index.controller';
import { InstrumentsRepository } from './repositories/instruments-json.repository';
import { InstrumentsBatchService } from './services/instruments-batch.service';
import { FacetsService } from './services/facets.service';
import { SearchIndexService } from './services/search-index.service';
import { SearchService } from './services/search.service';
import { SearchLog } from './search-log/search-log';

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
 * The search log module: the injected log, or a new one that counts results with the search service.
 */
export function initSearchLogModule(
  searchService: SearchService,
  clock: () => number,
  searchLog: SearchLog = new SearchLog({
    clock,
    countFor: async (spelling) =>
      (await searchService.searchAll({ search_text: spelling })).length,
  }),
): SearchLogController {
  return new SearchLogController(searchLog);
}
