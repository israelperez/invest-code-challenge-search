import { Context } from 'koa';

import { BaseController } from '../shared/controllers/base.controller';
import { ApiEndpoint } from '../shared/models/endpoint.model';

import { SearchLog } from '../search-log/search-log';
import { zeroResultGroups } from './zero-results';

export class InsightsController extends BaseController {
  // `ready` resolves once seeding is done, so a half-seeded log is never served.
  constructor(
    private searchLog: SearchLog,
    private ready: Promise<void> = Promise.resolve(),
  ) {
    super();

    this.router.get(ApiEndpoint.ZeroResults, this.zeroResults.bind(this));
  }

  async zeroResults(ctx: Context) {
    await this.ready;
    ctx.body = {
      groups: zeroResultGroups(this.searchLog.aggregates()),
      // The history is fake until real usage replaces it.
      includes_seed_data: true,
    };
  }
}
