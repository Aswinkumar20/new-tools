/** Minimal Thrift compact reader/writer for Parquet footers and page headers. */

export const T_STOP = 0;
export const T_TRUE = 1;
export const T_FALSE = 2;
export const T_BYTE = 3;
export const T_I16 = 4;
export const T_I32 = 5;
export const T_I64 = 6;
export const T_DOUBLE = 7;
export const T_BINARY = 8;
export const T_LIST = 9;
export const T_STRUCT = 12;

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

function writeVarint(value: bigint, out: number[]): void {
  let n = value < 0n ? 0n : value;
  while (n > 0x7fn) {
    out.push(Number(n & 0x7fn) | 0x80);
    n >>= 7n;
  }
  out.push(Number(n));
}

function zz32(n: number): bigint {
  return BigInt(((n << 1) ^ (n >> 31)) >>> 0);
}

function zz64(n: number | bigint): bigint {
  const x = BigInt(n);
  return (x << 1n) ^ (x >> 63n);
}

export class ThriftWriter {
  private readonly out: number[] = [];
  private lastFieldId = 0;
  private readonly stack: number[] = [];

  bytes(): Uint8Array {
    return Uint8Array.from(this.out);
  }

  pushStruct(): void {
    this.stack.push(this.lastFieldId);
    this.lastFieldId = 0;
  }

  popStruct(): void {
    this.out.push(T_STOP);
    this.lastFieldId = this.stack.pop() ?? 0;
  }

  private field(id: number, type: number): void {
    const delta = id - this.lastFieldId;
    if (delta > 0 && delta <= 15) this.out.push((delta << 4) | type);
    else {
      this.out.push(type);
      writeVarint(zz32(id), this.out);
    }
    this.lastFieldId = id;
  }

  writeI32(id: number, value: number): void {
    this.field(id, T_I32);
    writeVarint(zz32(value), this.out);
  }

  writeI64(id: number, value: number | bigint): void {
    this.field(id, T_I64);
    writeVarint(zz64(value), this.out);
  }

  writeBinary(id: number, value: string | Uint8Array): void {
    this.field(id, T_BINARY);
    const bytes = typeof value === 'string' ? te.encode(value) : value;
    writeVarint(BigInt(bytes.length), this.out);
    for (let i = 0; i < bytes.length; i++) this.out.push(bytes[i]);
  }

  writeListHeader(id: number, elemType: number, count: number): void {
    this.field(id, T_LIST);
    if (count <= 14) this.out.push((count << 4) | elemType);
    else {
      this.out.push(0xf0 | elemType);
      writeVarint(BigInt(count), this.out);
    }
  }

  writeI32Value(value: number): void {
    writeVarint(zz32(value), this.out);
  }

  writeBinaryValue(value: string): void {
    const bytes = te.encode(value);
    writeVarint(BigInt(bytes.length), this.out);
    for (let i = 0; i < bytes.length; i++) this.out.push(bytes[i]);
  }

  writeStructField(id: number, writeInner: () => void): void {
    this.field(id, T_STRUCT);
    this.pushStruct();
    writeInner();
    this.popStruct();
  }
}

export class ThriftReader {
  constructor(
    private readonly bytes: Uint8Array,
    public offset = 0
  ) {}

  private lastFieldId = 0;
  private readonly stack: number[] = [];

  remaining(): number {
    return this.bytes.length - this.offset;
  }

  private readByte(): number {
    if (this.offset >= this.bytes.length) throw new Error('Unexpected end of Thrift buffer');
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
      if (shift > 70n) throw new Error('Thrift varint too long');
    }
    return result;
  }

  private unzz(n: bigint): bigint {
    return (n >> 1n) ^ -(n & 1n);
  }

  readZigZag32(): number {
    return Number(this.unzz(this.readVarint()));
  }

  readZigZag64(): number {
    const v = this.unzz(this.readVarint());
    const n = Number(v);
    if (!Number.isSafeInteger(n)) return Number(v);
    return n;
  }

  pushStruct(): void {
    this.stack.push(this.lastFieldId);
    this.lastFieldId = 0;
  }

  popStruct(): void {
    this.lastFieldId = this.stack.pop() ?? 0;
  }

  readField(): { id: number; type: number } | null {
    const b = this.readByte();
    if (b === T_STOP) return null;
    const delta = (b >> 4) & 0x0f;
    const type = b & 0x0f;
    const id = delta === 0 ? this.readZigZag32() : this.lastFieldId + delta;
    this.lastFieldId = id;
    return { id, type };
  }

  readBinary(): Uint8Array {
    const len = Number(this.readVarint());
    if (len < 0 || this.offset + len > this.bytes.length) throw new Error('Invalid Thrift binary length');
    const slice = this.bytes.subarray(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }

  readString(): string {
    return td.decode(this.readBinary());
  }

  readListHeader(): { elemType: number; count: number } {
    const b = this.readByte();
    const elemType = b & 0x0f;
    let count = (b >> 4) & 0x0f;
    if (count === 15) count = Number(this.readVarint());
    return { elemType, count };
  }

  skip(type: number): void {
    switch (type) {
      case T_TRUE:
      case T_FALSE:
        return;
      case T_BYTE:
        this.readByte();
        return;
      case T_I16:
      case T_I32:
      case T_I64:
        this.readVarint();
        return;
      case T_DOUBLE:
        this.offset += 8;
        return;
      case T_BINARY:
        this.readBinary();
        return;
      case T_LIST: {
        const { elemType, count } = this.readListHeader();
        for (let i = 0; i < count; i++) this.skip(elemType);
        return;
      }
      case T_STRUCT:
        this.skipStruct();
        return;
      default:
        throw new Error(`Unsupported Thrift type ${type}`);
    }
  }

  skipStruct(): void {
    this.pushStruct();
    for (;;) {
      const f = this.readField();
      if (!f) break;
      this.skip(f.type);
    }
    this.popStruct();
  }
}

export const PQ_TYPE: Record<number, string> = {
  0: 'BOOLEAN',
  1: 'INT32',
  2: 'INT64',
  3: 'INT96',
  4: 'FLOAT',
  5: 'DOUBLE',
  6: 'BYTE_ARRAY',
  7: 'FIXED_LEN_BYTE_ARRAY'
};

export const PQ_CONVERTED: Record<number, string> = {
  0: 'UTF8',
  1: 'MAP',
  2: 'MAP_KEY_VALUE',
  3: 'LIST',
  4: 'ENUM',
  5: 'DECIMAL',
  6: 'DATE',
  7: 'TIME_MILLIS',
  8: 'TIME_MICROS',
  9: 'TIMESTAMP_MILLIS',
  10: 'TIMESTAMP_MICROS',
  11: 'UINT_8',
  12: 'UINT_16',
  13: 'UINT_32',
  14: 'UINT_64',
  15: 'INT_8',
  16: 'INT_16',
  17: 'INT_32',
  18: 'INT_64',
  19: 'JSON',
  20: 'BSON',
  21: 'INTERVAL'
};

export const PQ_REPETITION: Record<number, string> = {
  0: 'REQUIRED',
  1: 'OPTIONAL',
  2: 'REPEATED'
};

export const PQ_CODEC: Record<number, string> = {
  0: 'UNCOMPRESSED',
  1: 'SNAPPY',
  2: 'GZIP',
  3: 'LZO',
  4: 'BROTLI',
  5: 'LZ4',
  6: 'ZSTD'
};
