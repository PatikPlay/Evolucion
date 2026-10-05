/** Incremental 32-bit FNV-1a hash used to fingerprint simulation state. */
export class StateHasher {
  private h = 0x811c9dc5;

  bytes(view: Uint8Array): this {
    let h = this.h;
    for (let i = 0; i < view.length; i++) {
      h ^= view[i] as number;
      h = Math.imul(h, 0x01000193);
    }
    this.h = h;
    return this;
  }

  typed(arr: ArrayBufferView): this {
    return this.bytes(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
  }

  /** Hashes only the first `count` elements of a typed array. */
  typedPrefix(
    arr:
      | Float32Array
      | Float64Array
      | Int32Array
      | Uint32Array
      | Uint16Array
      | Uint8Array
      | Int16Array
      | Int8Array,
    count: number,
  ): this {
    const bytes = count * arr.BYTES_PER_ELEMENT;
    return this.bytes(new Uint8Array(arr.buffer, arr.byteOffset, Math.min(bytes, arr.byteLength)));
  }

  number(n: number): this {
    const buf = new Float64Array([n]);
    return this.typed(buf);
  }

  string(s: string): this {
    for (let i = 0; i < s.length; i++) {
      this.h ^= s.charCodeAt(i);
      this.h = Math.imul(this.h, 0x01000193);
    }
    return this;
  }

  digest(): number {
    return this.h >>> 0;
  }
}

export function hashToHex(h: number): string {
  return h.toString(16).padStart(8, '0');
}
