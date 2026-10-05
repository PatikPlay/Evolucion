import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { PROTOCOL_VERSION, parseClientMessage } from '@linaje/protocol';
import { ClientChannel } from './transport';
import { LiveSession } from './live';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

export interface AppOptions {
  port: number;
  host?: string;
  /** Directory of the built client to serve (optional in development). */
  staticDir?: string;
  debug: boolean;
}

/** HTTP server (static client) + WebSocket endpoint at /ws. */
export function startApp(opts: AppOptions): Promise<Server> {
  const http = createServer((req, res) => void serveStatic(req, res, opts.staticDir));
  const wss = new WebSocketServer({
    server: http,
    path: '/ws',
    perMessageDeflate: { threshold: 1024 },
  });
  wss.on('connection', (ws) => {
    const ch = new ClientChannel(ws, opts.debug);
    let live: LiveSession | null = null;
    ch.send({
      t: 'welcome',
      protocol: PROTOCOL_VERSION,
      clientId: randomUUID(),
      token: randomUUID(),
      debug: opts.debug,
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const msg = parseClientMessage(data.toString());
      if (!msg) {
        ch.send({ t: 'error', code: 'bad-message', message: 'Mensaje no válido' });
        return;
      }
      switch (msg.t) {
        case 'spectate':
          live?.stop();
          live = new LiveSession(ch, msg);
          live.start();
          break;
        case 'inspect':
          live?.inspect(msg.id);
          break;
        case 'speed':
          live?.setSpeed(msg.speed);
          break;
        case 'hello':
          break;
      }
    });
    ws.on('close', () => live?.stop());
  });
  return new Promise((resolve) =>
    http.listen(opts.port, opts.host ?? '0.0.0.0', () => resolve(http)),
  );
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, dir?: string): Promise<void> {
  if (!dir) {
    res.writeHead(404).end('Client not built. Run `pnpm build`, or use the Vite dev server.');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://x');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (path.includes('..')) {
    res.writeHead(400).end();
    return;
  }
  if (!path) path = 'index.html';
  let file = join(dir, path);
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(dir, 'index.html');
  }
  try {
    const body = await readFile(file);
    res
      .writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      .end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}
