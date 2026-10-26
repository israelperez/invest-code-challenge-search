import { InstrumentDocument } from './instrument.model';

export const MAX_BATCH_IDS = 100;

/**
 * Body of POST /instruments/batch. Unknown keys are rejected.
 */
export interface InstrumentsBatchRequest {
  // symbol_openfigi values, matched ignoring case.
  ids: string[];
  // indexed_at from an earlier response.
  snapshot: number;
}

export interface InstrumentsBatchResponse {
  // Found instruments in request order.
  documents: InstrumentDocument[];
  // Canonical (uppercase) IDs with no instrument, in request order.
  missing: string[];
  indexed_at: number;
}
