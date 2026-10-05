import {
  BinaryKind,
  binaryKind,
  decodeFauna,
  decodeFrame,
  decodeTerrain,
  decodeVegetation,
  type ClientMessage,
  type FaunaGrid,
  type Frame,
  type ServerMessage,
  type TerrainGrid,
  type VegetationGrid,
  type DebugMsg,
} from '@linaje/protocol';

export interface ConnectionHandlers {
  onMessage(msg: ServerMessage | DebugMsg): void;
  onFrame(f: Frame): void;
  onTerrain(t: TerrainGrid): void;
  onVegetation(v: VegetationGrid): void;
  onFauna(f: FaunaGrid): void;
  onStatus(connected: boolean): void;
}

/** WebSocket client. The server URL is relative, so the same build works on any host. */
export class Connection {
  private ws: WebSocket | null = null;
  private queue: ClientMessage[] = [];
  private closed = false;

  constructor(private readonly handlers: ConnectionHandlers) {}

  connect(): void {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      this.handlers.onStatus(true);
      for (const m of this.queue) ws.send(JSON.stringify(m));
      this.queue = [];
    };
    ws.onclose = () => {
      this.handlers.onStatus(false);
      if (!this.closed) setTimeout(() => this.connect(), 1500);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        this.handlers.onMessage(JSON.parse(ev.data) as ServerMessage | DebugMsg);
        return;
      }
      const buf = ev.data as ArrayBuffer;
      switch (binaryKind(buf)) {
        case BinaryKind.Frame:
          this.handlers.onFrame(decodeFrame(buf));
          break;
        case BinaryKind.Terrain:
          this.handlers.onTerrain(decodeTerrain(buf));
          break;
        case BinaryKind.Vegetation:
          this.handlers.onVegetation(decodeVegetation(buf));
          break;
        case BinaryKind.Fauna:
          this.handlers.onFauna(decodeFauna(buf));
          break;
      }
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }
}
