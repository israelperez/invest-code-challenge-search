import { Context } from 'koa';
import { StatusCodes } from 'http-status-codes';

import { BaseController } from '../shared/controllers/base.controller';
import { ApiEndpoint } from '../shared/models/endpoint.model';

import { SearchLog, devLog } from '../search-log/search-log';
import { validateSearchLogRequest } from '../validation/search-log.validation';

export class SearchLogController extends BaseController {
  constructor(private searchLog: SearchLog) {
    super();

    this.router.post(ApiEndpoint.Searches, this.log.bind(this));
  }

  async log(ctx: Context) {
    const body = ctx.request.body as { term: string; submission_id: string };
    const clientId = ctx.get('X-Client-Id');
    const error = validateSearchLogRequest(body, clientId);

    if (error) {
      devLog('search-log.rejected', { reason: error });
    }
    ctx.assert(!error, StatusCodes.BAD_REQUEST, error ?? '');

    // Whether it was recorded, dropped or ignored is not the client's business.
    await this.searchLog.submit({
      term: body.term,
      submissionId: body.submission_id,
      clientId,
      ip: ctx.ip,
    });
    ctx.status = StatusCodes.ACCEPTED;
  }
}
