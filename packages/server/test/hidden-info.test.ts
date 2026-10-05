import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { WebSocket } from 'ws';
import { findForbiddenKeys, validateServerMessage, BinaryKind, binaryKind } from '@linaje/protocol';
import { startApp } from '../src/app';

let server: Server;
let port = 0;

beforeAll(async () => {
  server = await startApp({ port: 0, host: '127.0.0.1', debug: false });
  const addr = server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;
});

afterAll(() => {
  server.close();
});

function collect(msg: object, ms: number): Promise<{ json: unknown[]; binary: ArrayBuffer[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const json: unknown[] = [];
    const binary: ArrayBuffer[] = [];
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const b = data as Buffer;
        binary.push(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
      } else json.push(JSON.parse(data.toString()));
    });
    ws.on('open', () => {
      ws.send(JSON.stringify(msg));
      setTimeout(() => {
        // Ask for a field card too.
        ws.send(JSON.stringify({ t: 'inspect', id: 1 }));
      }, ms / 2);
      setTimeout(() => {
        ws.close();
        resolve({ json, binary });
      }, ms);
    });
    ws.on('error', reject);
  });
}

describe('hidden information over the wire (dev viewer)', () => {
  it('every JSON message passes the whitelist and carries no forbidden keys', async () => {
    const { json, binary } = await collect(
      { t: 'spectate', seed: 'wire', years: 0, scenario: 'none' },
      2500,
    );
    expect(json.length).toBeGreaterThan(3);
    for (const m of json) {
      expect(() => validateServerMessage(m)).not.toThrow();
      expect(findForbiddenKeys(m)).toEqual([]);
      expect((m as { t: string }).t).not.toBe('debug');
    }
    const kinds = new Set(binary.map((b) => binaryKind(b)));
    expect(kinds.has(BinaryKind.Frame)).toBe(true);
    expect(kinds.has(BinaryKind.Terrain)).toBe(true);
  });

  it('rejects malformed client messages', async () => {
    const { json } = await collect(
      { t: 'spectate', seed: 'x', years: 0, scenario: 'none', energy: 5 },
      600,
    );
    expect(json.some((m) => (m as { t: string }).t === 'error')).toBe(true);
  });
});
