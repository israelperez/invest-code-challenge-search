import { Context } from 'koa';
import { StatusCodes } from 'http-status-codes';

import { BaseController } from '../shared/controllers/base.controller';
import { ApiEndpoint } from '../shared/models/endpoint.model';

import { popularTerms } from '../search-log/popular';
import { SearchLog } from '../search-log/search-log';
import { validatePopularQuery } from '../validation/popular.validation';

export class PopularController extends BaseController {
  // `ready` resolves once seeding is done, so a half-seeded list is never served.
  constructor(
    private searchLog: SearchLog,
    private ready: Promise<void> = Promise.resolve(),
  ) {
    super();

    this.router.get(ApiEndpoint.Popular, this.popular.bind(this));
  }

  async popular(ctx: Context) {
    const parsed = validatePopularQuery(ctx.query);
    ctx.assert(
      'limit' in parsed,
      StatusCodes.BAD_REQUEST,
      'error' in parsed ? parsed.error : '',
    );

    await this.ready;
    ctx.body = {
      terms: popularTerms(this.searchLog.aggregates(), parsed.limit),
      // The history is fake until real usage replaces it.
      includes_seed_data: true,
    };
  }
}
