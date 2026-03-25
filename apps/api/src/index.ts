import { createApp } from './server/create-app';
import { env, validateEnv } from './config/env';
import { logger } from './lib/logger';
import {
  initializeDependencies,
  closeDependencies,
} from './server/initialize-dependencies';

async function bootstrap(): Promise<void> {
  validateEnv();
  
  const dependenciesRuntime = await initializeDependencies();

  const app = createApp(dependenciesRuntime);
  const server = app.listen(env.port, () => {
    logger.info(`API server listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      await closeDependencies(dependenciesRuntime);
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      logger.error('Shutdown failed', error);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      logger.error('Shutdown failed', error);
      process.exit(1);
    });
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start application', error);
  process.exit(1);
});
