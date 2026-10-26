import Koa from 'koa';
import cors from '@koa/cors';
import { bodyParser } from '@koa/bodyparser';
import Router from '@koa/router';

import {
  FacetsController,
  InstrumentsBatchController,
  InstrumentsRepository,
  JsonInstrumentsRepository,
  SearchController,
  SearchIndexController,
  SearchLogController,
  initSearchLogModule,
  initSearchModule,
} from './index';
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
  // Config has no consumers yet.
  config = envConfig,
}: AppDeps = {}): Koa {
  const app = new Koa();

  // Register app middlewares.
  registerAppMiddleware(app);

  // Initialise app modules and their controllers.
  const controllers: AppControllers = initAppModules(
    repository,
    clock,
    searchLog,
  );

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
  instrumentsBatchController: InstrumentsBatchController;
  facetsController: FacetsController;
}

function initAppModules(
  repository: InstrumentsRepository,
  clock: () => number,
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
  const searchLogController = initSearchLogModule(
    searchService,
    clock,
    searchLog,
  );

  return {
    healthController,
    searchController,
    searchIndexController,
    searchLogController,
    instrumentsBatchController,
    facetsController,
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
