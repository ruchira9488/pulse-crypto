/**
 * Load / slow-consumer test against a running gateway.
 *
 *   npm run loadtest -w backend -- --clients 200 --slow 5 --seconds 20
 *
 * Opens N normal clients plus S "slow" clients that stop reading from their
 * TCP socket. A healthy gateway keeps memory flat, keeps serving the normal
 * clients, and disconnects the slow ones with close code 1013.
 */
import WebSocket from 'ws';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const url = process.env.WS_URL ?? 'ws://localhost:8080/ws';
const healthUrl = url.replace(/^ws/, 'http').replace(/\/ws$/, '/health');
const clients = arg('clients', 100);
const slow = arg('slow', 3);
const seconds = arg('seconds', 15);

let frames = 0;
let bytes = 0;
const closeCodes = new Map<number, number>();

function open(isSlow: boolean) {
  const ws = new WebSocket(url);
  ws.on('open', () => {
    // Stop draining the socket: the server's bufferedAmount for this client grows.
    if (isSlow) (ws as unknown as { _socket: { pause(): void } })._socket.pause();
  });
  ws.on('message', (data: Buffer) => {
    frames += 1;
    bytes += data.length;
  });
  ws.on('close', (code) => closeCodes.set(code, (closeCodes.get(code) ?? 0) + 1));
  ws.on('error', () => {});
  return ws;
}

async function main() {
  console.log(`connecting ${clients} clients + ${slow} slow clients to ${url} for ${seconds}s`);
  const sockets = [
    ...Array.from({ length: clients }, () => open(false)),
    ...Array.from({ length: slow }, () => open(true)),
  ];
  const timer = setInterval(async () => {
    const health = (await (await fetch(healthUrl)).json()) as Record<string, unknown>;
    console.log(
      `rx ${(frames / clients).toFixed(0)} frames/client  ${(bytes / 1024 / 1024).toFixed(1)}MB total | server: clients=${health.clients} rss=${health.memoryMb}MB skipped=${health.framesSkipped} slowDisconnects=${health.slowConsumerDisconnects}`,
    );
  }, 2_000);
  await new Promise((r) => setTimeout(r, seconds * 1_000));
  clearInterval(timer);
  sockets.forEach((s) => s.terminate());
  console.log('close codes seen during the run:', Object.fromEntries(closeCodes));
}

void main();
