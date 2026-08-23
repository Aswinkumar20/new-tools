/** Minimal protobuf writer/reader for ORC footers (varint + length-delimited). */

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

export function writePbVarint(value: number | bigint, out: number[]): void {
  let n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n) n = 0n;
  while (n > 0x7fn) {
    out.push(Number(n & 0x7fn) | 0x80);
    n >>= 7n;
  }
  out.push(Number(n));
}

export class PbWriter {
  readonly out: number[] = [];

  bytes(): Uint8Array {
    return Uint8Array.from(this.out);
  }

  key(field: number, wire: number): void {
    writePbVarint((field << 3) | wire, this.out);
  }

  uint(field: number, value: number | bigint): void {
    this.key(field, 0);
    writePbVarint(value, this.out);
  }

  bytesField(field: number, value: string | Uint8Array): void {
    const b = typeof value === 'string' ? te.encode(value) : value;
    this.key(field, 2);
    writePbVarint(b.length, this.out);
    this.out.push(...b);
  }

  message(field: number, inner: Uint8Array): void {
    this.bytesField(field, inner);
  }
}

export class PbReader {
  constructor(
    private readonly bytes: Uint8Array,
    public offset = 0,
    private readonly end = bytes.length
  ) {}

  remaining(): number {
    return this.end - this.offset;
  }

  private readByte(): number {
    if (this.offset >= this.end) throw new Error('Unexpected end of protobuf buffer');
    return this.bytes[this.offset++];
  }

  readVarint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const b = BigInt(this.readByte());
      result |= (b & 0x7fn) << shift;
      if (!(b & 0x80n)) break;
      shift += 7n;
      if (shift > 70n) throw new Error('Protobuf varint too long');
    }
    return result;
  }

  readUint(): number {
    return Number(this.readVarint());
  }

  readBytes(): Uint8Array {
    const len = this.readUint();
    if (len < 0 || this.offset + len > this.end) throw new Error('Invalid protobuf bytes length');
    const slice = this.bytes.subarray(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }

  readString(): string {
    return td.decode(this.readBytes());
  }

  skip(wire: number): void {
    if (wire === 0) this.readVarint();
    else if (wire === 1) this.offset += 8;
    else if (wire === 2) this.readBytes();
    else if (wire === 5) this.offset += 4;
    else throw new Error(`Unsupported protobuf wire type ${wire}`);
  }

  next(): { field: number; wire: number } | null {
    if (this.offset >= this.end) return null;
    const key = this.readVarint();
    return { field: Number(key >> 3n), wire: Number(key & 7n) };
  }

  nested(): PbReader {
    const inner = this.readBytes();
    return new PbReader(inner, 0, inner.length);
  }
}

export function zzEncode(n: number | bigint): bigint {
  const x = BigInt(n);
  return (x << 1n) ^ (x >> 63n);
}

export function zzDecode(n: bigint): number {
  const v = (n >> 1n) ^ -(n & 1n);
  return Number(v);
}

export function writeZigZagVarint(n: number | bigint, out: number[]): void {
  writePbVarint(zzEncode(n), out);
}

export function readZigZagVarint(bytes: Uint8Array, offset: { o: number }): number {
  let result = 0n;
  let shift = 0n;
  for (;;) {
    if (offset.o >= bytes.length) throw new Error('Unexpected end of RLE buffer');
    const b = BigInt(bytes[offset.o++]);
    result |= (b & 0x7fn) << shift;
    if (!(b & 0x80n)) break;
    shift += 7n;
  }
  return zzDecode(result);
}
