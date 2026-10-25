import { FacetsController } from './controllers/facets.controller';
import { SearchController } from './controllers/search.controller';
import { InstrumentsRepository } from './repositories/instruments-json.repository';
import { FacetsService } from './services/facets.service';
import { SearchService } from './services/search.service';

/**
 * This module instantiates the services which depend on the repository and the controllers which are
 * exported to main to register their routes.
 */
export interface SearchModuleResult {
  searchController: SearchController;
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
    searchController: new SearchController(searchService),
    facetsController: new FacetsController(facetsService),
  };
}
