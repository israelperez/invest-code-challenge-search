import { SearchLog } from '../search-log/search-log';
import { InsightsController } from './insights.controller';

/**
 * The insights module: development-only views over the search log. Its whole surface is this folder plus
 * the registration lines in app.ts, so removing it leaves the rest untouched.
 */
export function initInsightsModule(
  searchLog: SearchLog,
  ready: Promise<void>,
): { insightsController: InsightsController } {
  return { insightsController: new InsightsController(searchLog, ready) };
}
