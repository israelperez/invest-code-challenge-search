// Expose selected models.
export * from './models/instrument.model';
export * from './models/search-query.model';

// Expose the repository contract and its JSON file implementation.
export {
  InstrumentsRepository,
  JsonInstrumentsRepository,
} from './repositories/instruments-json.repository';

// Expose controllers for main to register.
export { SearchController } from './controllers/search.controller';
export { SearchIndexController } from './controllers/search-index.controller';
export { InstrumentsBatchController } from './controllers/instruments-batch.controller';
export { SearchLogController } from './controllers/search-log.controller';
export { PopularController } from './controllers/popular.controller';
export { FacetsController } from './controllers/facets.controller';

// Expose module init.
export { initSearchModule, initSearchLogModule } from './module';
