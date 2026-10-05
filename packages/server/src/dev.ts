import { startApp } from './app';

const port = Number(process.env.PORT ?? 8787);
const debug = process.env.LINAJE_DEBUG === '1';
await startApp({
  port,
  debug,
  ...(process.env.LINAJE_STATIC ? { staticDir: process.env.LINAJE_STATIC } : {}),
});
console.log(`Linaje dev server on ws://localhost:${port}/ws${debug ? ' (debug)' : ''}`);
