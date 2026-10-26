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
export { FacetsController } from './controllers/facets.controller';

// Expose module init.
export { initSearchModule } from './module';
