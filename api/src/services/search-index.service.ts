import { InstrumentDocument } from '../models/instrument.model';
import {
  DEFAULT_DOCUMENT_LIMIT,
  DEFAULT_ID_LIMIT,
  INCLUDE_VALUES,
  SearchIndexRequest,
  SearchIndexResponse,
} from '../models/search-index.model';
import { InstrumentsRepository } from '../repositories/instruments-json.repository';
import { countFacets } from './index-facets';
import { SearchService } from './search.service';

export class SearchIndexService {
  private searchService: SearchService;

  constructor(private repository: InstrumentsRepository) {
    // Every sort in SearchService is stable, so feeding it documents already sorted by
    // symbol_openfigi makes the id the final tiebreak. Legacy /search keeps the unwrapped repository.
    this.searchService = new SearchService({
      getAll: async () => [...(await repository.getAll())].sort(compareIds),
      getIndexedAt: () => repository.getIndexedAt(),
    });
  }

  getIndexedAt(): Promise<number> {
    return this.repository.getIndexedAt();
  }

  /**
   * Runs one search pass and returns the parts named by include.
   */
  async search(request: SearchIndexRequest): Promise<SearchIndexResponse> {
    const include = new Set(request.include ?? INCLUDE_VALUES);
    const [matches, indexed_at, all] = await Promise.all([
      this.searchService.searchAll(request),
      this.repository.getIndexedAt(),
      // Facet options come from every document, not only the matches.
      include.has('facets') ? this.repository.getAll() : [],
    ]);
    const response: SearchIndexResponse = { indexed_at };

    if (include.has('count')) {
      response.count = matches.length;
    }

    if (include.has('facets')) {
      response.facets = await countFacets(
        this.searchService,
        request,
        matches,
        all,
      );
    }

    if (include.has('ids')) {
      const offset = request.id_offset ?? 0;
      const window = matches.slice(
        offset,
        offset + (request.id_limit ?? DEFAULT_ID_LIMIT),
      );
      const next = offset + window.length;

      response.ids = window.map((document) => document.symbol_openfigi);
      response.next_id_offset = next < matches.length ? next : null;

      if (include.has('documents')) {
        response.documents = window.slice(
          0,
          request.document_limit ?? DEFAULT_DOCUMENT_LIMIT,
        );
      }
    }

    return response;
  }
}

function compareIds(a: InstrumentDocument, b: InstrumentDocument): number {
  if (a.symbol_openfigi === b.symbol_openfigi) {
    return 0;
  }
  return a.symbol_openfigi < b.symbol_openfigi ? -1 : 1;
}
