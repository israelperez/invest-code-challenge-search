import { createApp } from './app';
import { envConfig } from './shared/configs/env.config';

function bootstrap() {
  const app = createApp();

  // Start serving.
  const port = envConfig.port;
  app
    .listen(port)
    .on('listening', () =>
      console.log(`Search Mock API listening on http://localhost:${port}`),
    );
}

try {
  bootstrap();
} catch (err) {
  console.error('Failed to init server:', err);
  process.exit(1);
}
