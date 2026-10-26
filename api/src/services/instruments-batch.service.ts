import {
  InstrumentsBatchRequest,
  InstrumentsBatchResponse,
} from '../models/instruments-batch.model';
import { InstrumentsRepository } from '../repositories/instruments-json.repository';

export class InstrumentsBatchService {
  constructor(private repository: InstrumentsRepository) {}

  getIndexedAt(): Promise<number> {
    return this.repository.getIndexedAt();
  }

  /**
   * Looks up each ID ignoring case, collapsing duplicates, and reports the IDs with no instrument.
   */
  async getBatch({
    ids,
  }: Pick<InstrumentsBatchRequest, 'ids'>): Promise<InstrumentsBatchResponse> {
    const [all, indexed_at] = await Promise.all([
      this.repository.getAll(),
      this.repository.getIndexedAt(),
    ]);
    const byId = new Map(
      all.map((document) => [document.symbol_openfigi.toUpperCase(), document]),
    );
    const response: InstrumentsBatchResponse = {
      documents: [],
      missing: [],
      indexed_at,
    };

    for (const id of new Set(ids.map((id) => id.toUpperCase()))) {
      const document = byId.get(id);
      if (document) {
        response.documents.push(document);
      } else {
        response.missing.push(id);
      }
    }

    return response;
  }
}
