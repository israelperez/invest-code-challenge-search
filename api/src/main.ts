import { createApp } from './app';
import { envConfig } from './shared/configs/env.config';

function bootstrap() {
  const app = createApp();

  // Save the search log before exiting; the signal is re-sent so the default exit still happens.
  // SIGUSR2 is what nodemon sends to restart.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGUSR2'] as const) {
    process.once(signal, () => {
      app.emit('shutdown');
      process.kill(process.pid, signal);
    });
  }

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
