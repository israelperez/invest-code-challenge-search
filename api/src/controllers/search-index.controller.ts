import { Context } from 'koa';
import { StatusCodes } from 'http-status-codes';

import { BaseController } from '../shared/controllers/base.controller';
import { ApiEndpoint } from '../shared/models/endpoint.model';

import { SearchIndexRequest } from '../models/search-index.model';
import { SearchIndexService } from '../services/search-index.service';
import { validateSearchIndexRequest } from '../validation/search-index.validation';

export class SearchIndexController extends BaseController {
  constructor(private searchIndexService: SearchIndexService) {
    super();

    this.registerRoutes();
  }

  private registerRoutes() {
    this.router.post(ApiEndpoint.SearchIndex, this.searchIndex.bind(this));
    this.router.get(ApiEndpoint.Version, this.getVersion.bind(this));
  }

  async searchIndex(ctx: Context) {
    const request = ctx.request.body as SearchIndexRequest;
    const error = validateSearchIndexRequest(request);

    ctx.assert(!error, StatusCodes.BAD_REQUEST, error ?? '');

    const indexed_at = await this.searchIndexService.getIndexedAt();

    // The error middleware only emits { message }, so the 409 sets indexed_at itself.
    if (request.snapshot !== undefined && request.snapshot !== indexed_at) {
      ctx.status = StatusCodes.CONFLICT;
      ctx.body = {
        message: 'The snapshot is stale, restart from the first window',
        indexed_at,
      };
      return;
    }

    ctx.body = await this.searchIndexService.search(request);
  }

  async getVersion(ctx: Context) {
    ctx.body = { indexed_at: await this.searchIndexService.getIndexedAt() };
  }
}
