import Koa from 'koa';
import cors from '@koa/cors';
import { bodyParser } from '@koa/bodyparser';
import Router from '@koa/router';

import {
  FacetsController,
  InstrumentsBatchController,
  InstrumentsRepository,
  JsonInstrumentsRepository,
  PopularController,
  SearchController,
  SearchIndexController,
  SearchLogController,
  initSearchLogModule,
  initSearchModule,
} from './index';
import { InsightsController } from './insights/insights.controller';
import { initInsightsModule } from './insights/module';
import { SearchLogAdminController } from './search-log-admin/search-log-admin.controller';
import { initSearchLogAdminModule } from './search-log-admin/module';
import { SearchLog } from './search-log/search-log';
import { HealthController } from './health/health.controller';
import { EnvVarsConfig, envConfig } from './shared/configs/env.config';
import { errorMiddleware } from './shared/middleware/error.middleware';
import { notFoundMiddleware } from './shared/middleware/not-found.middleware';

/**
 * Everything the app can be given from outside, so tests get fresh state. Each one is optional.
 */
export interface AppDeps {
  repository?: InstrumentsRepository;
  clock?: () => number;
  searchLog?: SearchLog;
  config?: EnvVarsConfig;
}

/**
 * Builds the Koa app without listening, so tests can call it in-process.
 */
export function createApp({
  repository = new JsonInstrumentsRepository(envConfig.instrumentsFile),
  clock = () => Date.now(),
  searchLog,
  config = envConfig,
}: AppDeps = {}): Koa {
  const app = new Koa();

  // Register app middlewares.
  registerAppMiddleware(app);

  // Initialise app modules and their controllers.
  const controllers: AppControllers = initAppModules(
    repository,
    clock,
    config.searchLogFile,
    config.enableInsights,
    searchLog,
  );

  // main.ts emits this on shutdown so a pending search log save isn't lost.
  app.on('shutdown', controllers.flushSearchLog);

  // Register app routes with controllers.
  registerAppRoutes(app, controllers);

  return app;
}

/**
 * Initialise app modules and return resulting controllers.
 */
interface AppControllers {
  healthController: HealthController;
  searchController: SearchController;
  searchIndexController: SearchIndexController;
  searchLogController: SearchLogController;
  popularController: PopularController;
  // Undefined when the enableInsights flag is off, so the route 404s.
  insightsController?: InsightsController;
  // Undefined when the enableInsights flag is off, so the routes 404.
  searchLogAdminController?: SearchLogAdminController;
  instrumentsBatchController: InstrumentsBatchController;
  facetsController: FacetsController;
  flushSearchLog: () => boolean;
}

function initAppModules(
  repository: InstrumentsRepository,
  clock: () => number,
  searchLogFile: string,
  enableInsights: boolean,
  searchLog?: SearchLog,
): AppControllers {
  const healthController = new HealthController();

  const {
    searchService,
    searchController,
    searchIndexController,
    instrumentsBatchController,
    facetsController,
  } = initSearchModule(repository);
  const {
    searchLogController,
    popularController,
    searchLog: log,
    ready,
    flushSearchLog,
  } = initSearchLogModule(searchService, clock, searchLogFile, searchLog);
  const insightsController = enableInsights
    ? initInsightsModule(log, ready).insightsController
    : undefined;
  const searchLogAdminController = enableInsights
    ? initSearchLogAdminModule(log, ready, flushSearchLog)
        .searchLogAdminController
    : undefined;

  return {
    healthController,
    searchController,
    searchIndexController,
    searchLogController,
    popularController,
    insightsController,
    searchLogAdminController,
    instrumentsBatchController,
    facetsController,
    flushSearchLog,
  };
}

/**
 * Registers app routes with controllers.
 */
function registerAppRoutes(app: Koa, controllers: AppControllers) {
  const routers: Router[] = [
    controllers.healthController.getRouter(),
    controllers.searchController.getRouter(),
    controllers.instrumentsBatchController.getRouter(),
    controllers.searchIndexController.getRouter(),
    controllers.searchLogController.getRouter(),
    controllers.popularController.getRouter(),
    ...(controllers.insightsController
      ? [controllers.insightsController.getRouter()]
      : []),
    ...(controllers.searchLogAdminController
      ? [controllers.searchLogAdminController.getRouter()]
      : []),
    controllers.facetsController.getRouter(),
  ];

  for (const router of routers) {
    // Throwing lets the error middleware return 405s as JSON.
    app.use(router.routes()).use(router.allowedMethods({ throw: true }));
  }
}

/**
 * Registers global middleware.
 */
function registerAppMiddleware(app: Koa) {
  app.use(errorMiddleware);
  app.use(notFoundMiddleware);
  app.use(cors());
  app.use(
    bodyParser({
      encoding: 'utf-8',
      // Set explicitly so it is a decision, not the library default.
      jsonLimit: '32kb',
      parsedMethods: ['POST'],
      // Parse every POST body as JSON whatever its Content-Type, like the real Search API.
      detectJSON: () => true,
    }),
  );
}
