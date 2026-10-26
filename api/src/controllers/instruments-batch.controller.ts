import { Context } from 'koa';
import { StatusCodes } from 'http-status-codes';

import { BaseController } from '../shared/controllers/base.controller';
import { ApiEndpoint } from '../shared/models/endpoint.model';

import { InstrumentsBatchRequest } from '../models/instruments-batch.model';
import { InstrumentsBatchService } from '../services/instruments-batch.service';
import { validateInstrumentsBatchRequest } from '../validation/instruments-batch.validation';

export class InstrumentsBatchController extends BaseController {
  constructor(private instrumentsBatchService: InstrumentsBatchService) {
    super();

    this.router.post(
      ApiEndpoint.InstrumentsBatch,
      this.instrumentsBatch.bind(this),
    );
  }

  async instrumentsBatch(ctx: Context) {
    const request = ctx.request.body as InstrumentsBatchRequest;
    const error = validateInstrumentsBatchRequest(request);

    ctx.assert(!error, StatusCodes.BAD_REQUEST, error ?? '');

    const indexed_at = await this.instrumentsBatchService.getIndexedAt();

    // The error middleware only emits { message }, so the 409 sets indexed_at itself.
    if (request.snapshot !== indexed_at) {
      ctx.status = StatusCodes.CONFLICT;
      ctx.body = {
        message: 'The snapshot is stale, restart from the first window',
        indexed_at,
      };
      return;
    }

    ctx.body = await this.instrumentsBatchService.getBatch(request);
  }
}
