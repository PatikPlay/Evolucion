import type { WebSocket } from 'ws';
import { validateServerMessage, type DebugMsg, type ServerMessage } from '@linaje/protocol';

/**
 * Every message to a client goes through here: JSON messages are validated
 * against the protocol whitelist; an invalid message is a server bug and is
 * never sent.
 */
export class ClientChannel {
  /** Optional tap used by tests to inspect everything sent. */
  static tap: ((json: unknown, binary: ArrayBuffer | null) => void) | null = null;

  constructor(
    readonly ws: WebSocket,
    readonly debug: boolean,
  ) {}

  send(msg: ServerMessage | DebugMsg): void {
    validateServerMessage(msg, { debug: this.debug });
    ClientChannel.tap?.(msg, null);
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendBinary(buf: ArrayBuffer): void {
    ClientChannel.tap?.(null, buf);
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(new Uint8Array(buf), { binary: true });
  }

  get open(): boolean {
    return this.ws.readyState === this.ws.OPEN;
  }
}
