import { loadConfig } from './app/config';
import { createServer } from './app/server';

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const address = await server.start();
  server.app.log.info(
    { address, ws: `${address.replace(/^http/, 'ws')}/ws`, pairs: config.pairs, source: config.marketSource },
    'PulseCrypto gateway ready',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.app.log.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 5_000);
    force.unref();
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
