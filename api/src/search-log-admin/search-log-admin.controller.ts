import { Context } from 'koa';
import { StatusCodes } from 'http-status-codes';

import { BaseController } from '../shared/controllers/base.controller';
import { ApiEndpoint } from '../shared/models/endpoint.model';

import { SearchLog, SeedEntry } from '../search-log/search-log';

export class SearchLogAdminController extends BaseController {
  // `ready` resolves once the first seeding is done, so a reset never races it.
  constructor(
    private searchLog: SearchLog,
    private ready: Promise<void>,
    private flush: () => boolean,
    private loadSeed: () => SeedEntry[],
  ) {
    super();

    this.router.delete(ApiEndpoint.SearchLogAdmin, this.clear.bind(this));
    this.router.post(
      ApiEndpoint.SearchLogRestoreSeed,
      this.restoreSeed.bind(this),
    );
  }

  async clear(ctx: Context) {
    this.assertNoInput(ctx);
    await this.ready;
    this.searchLog.clear();
    this.saved();
    ctx.status = StatusCodes.NO_CONTENT;
  }

  async restoreSeed(ctx: Context) {
    this.assertNoInput(ctx);
    await this.ready;
    await this.searchLog.replaceWith(this.loadSeed());
    this.saved();
    ctx.status = StatusCodes.NO_CONTENT;
  }

  // The change stays in memory when the save fails (no rollback for a demo reset), but the client is told so a restart is not a surprise.
  private saved() {
    if (!this.flush()) throw new Error('Search log could not be saved');
  }

  // Strict like the other new endpoints: these take no query parameters and no body fields.
  private assertNoInput(ctx: Context) {
    const body = ctx.request.body as Record<string, unknown> | undefined;
    ctx.assert(
      !ctx.querystring,
      StatusCodes.BAD_REQUEST,
      'No query parameters are accepted',
    );
    ctx.assert(
      !body || Object.keys(body).length === 0,
      StatusCodes.BAD_REQUEST,
      'No body fields are accepted',
    );
  }
}
