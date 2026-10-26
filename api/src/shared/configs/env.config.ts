import path from 'path';

/**
 * Access to environment configs with defaults. These can be overridden when starting the server, e.g.
 * PORT=3000 INSTRUMENTS_FILE=path/to/instruments.json npm start
 */

export interface EnvVarsConfig {
  port: number;
  searchLogFile: string;
  instrumentsFile: string;
}

export const envConfig: EnvVarsConfig = {
  // The persisted search log (SEARCH_LOG_FILE overrides); delete it, or run `npm run reset-log`, to start from the seed again.
  searchLogFile: path.resolve(process.env.SEARCH_LOG_FILE ?? 'data/search-log.json'),
  // 8787 is the port the real Search API worker serves on in local development.
  port: Number(process.env.PORT ?? 8787),
  instrumentsFile: path.resolve(
    process.env.INSTRUMENTS_FILE ?? 'data/instruments.json',
  ),
};
