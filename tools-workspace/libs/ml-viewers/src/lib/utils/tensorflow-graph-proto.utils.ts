/** Minimal protobuf wire codec for TensorFlow GraphDef (subset, no npm deps). */

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

class ProtoWriter {
  private readonly out: number[] = [];

  varint(value: number): this {
    let v = value >>> 0;
    while (v > 0x7f) {
      this.out.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    this.out.push(v);
    return this;
  }

  tag(field: number, wire: number): this {
    return this.varint((field << 3) | wire);
  }

  str(field: number, value: string): this {
    if (!value) return this;
    const bytes = te.encode(value);
    this.tag(field, 2);
    this.varint(bytes.length);
    this.out.push(...bytes);
    return this;
  }

  msg(field: number, child: Uint8Array): this {
    this.tag(field, 2);
    this.varint(child.length);
    this.out.push(...child);
    return this;
  }

  finish(): Uint8Array {
    return new Uint8Array(this.out);
  }
}

class ProtoReader {
  private offset: number;

  constructor(
    private readonly bytes: Uint8Array,
    start = 0,
    private readonly end = bytes.length
  ) {
    this.offset = start;
  }

  get remaining(): boolean {
    return this.offset < this.end;
  }

  private readVarint(): number {
    let result = 0;
    let shift = 0;
    while (this.offset < this.end) {
      const b = this.bytes[this.offset++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
      if (shift > 35) throw new Error('Invalid protobuf varint');
    }
    throw new Error('Truncated protobuf varint');
  }

  next(): { field: number; wire: number; varint: number; bytes: Uint8Array } | null {
    if (this.offset >= this.end) return null;
    const key = this.readVarint();
    const field = key >>> 3;
    const wire = key & 7;
    if (wire === 0) return { field, wire, varint: this.readVarint(), bytes: new Uint8Array(0) };
    if (wire === 2) {
      const len = this.readVarint();
      const start = this.offset;
      this.offset += len;
      if (this.offset > this.end) throw new Error('Truncated protobuf bytes');
      return { field, wire, varint: 0, bytes: this.bytes.subarray(start, start + len) };
    }
    if (wire === 5) {
      this.offset += 4;
      if (this.offset > this.end) throw new Error('Truncated protobuf float');
      return { field, wire, varint: 0, bytes: new Uint8Array(0) };
    }
    if (wire === 1) {
      this.offset += 8;
      if (this.offset > this.end) throw new Error('Truncated protobuf fixed64');
      return { field, wire, varint: 0, bytes: new Uint8Array(0) };
    }
    throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
}

export interface DecodedTfNode {
  name: string;
  op: string;
  device: string;
  inputs: string[];
}

export interface DecodedTfGraph {
  nodes: DecodedTfNode[];
}

function encodeNode(name: string, op: string, inputs: string[] = [], device = ''): Uint8Array {
  const w = new ProtoWriter().str(1, name).str(2, op);
  if (device) w.str(3, device);
  for (const input of inputs) w.str(4, input);
  return w.finish();
}

export function encodeShopRankerTfGraph(): Uint8Array {
  const g = new ProtoWriter();
  g.msg(1, encodeNode('features', 'Placeholder'));
  g.msg(1, encodeNode('W1', 'Const'));
  g.msg(1, encodeNode('b1', 'Const'));
  g.msg(1, encodeNode('gemm1', 'MatMul', ['features', 'W1']));
  g.msg(1, encodeNode('add1', 'Add', ['gemm1', 'b1']));
  g.msg(1, encodeNode('relu1', 'Relu', ['add1']));
  g.msg(1, encodeNode('W2', 'Const'));
  g.msg(1, encodeNode('b2', 'Const'));
  g.msg(1, encodeNode('gemm2', 'MatMul', ['relu1', 'W2']));
  g.msg(1, encodeNode('add2', 'Add', ['gemm2', 'b2']));
  g.msg(1, encodeNode('scores', 'Softmax', ['add2']));
  return g.finish();
}

function decodeNode(bytes: Uint8Array): DecodedTfNode {
  const reader = new ProtoReader(bytes);
  let name = '';
  let op = '';
  let device = '';
  const inputs: string[] = [];
  while (reader.remaining) {
    const field = reader.next();
    if (!field) break;
    if (field.field === 1 && field.wire === 2) name = td.decode(field.bytes);
    if (field.field === 2 && field.wire === 2) op = td.decode(field.bytes);
    if (field.field === 3 && field.wire === 2) device = td.decode(field.bytes);
    if (field.field === 4 && field.wire === 2) inputs.push(td.decode(field.bytes));
  }
  return { name, op, device, inputs };
}

export function decodeTfGraphDef(bytes: Uint8Array): DecodedTfGraph {
  const reader = new ProtoReader(bytes);
  const nodes: DecodedTfNode[] = [];
  let fields = 0;
  while (reader.remaining) {
    const field = reader.next();
    if (!field) break;
    fields += 1;
    if (field.field === 1 && field.wire === 2) nodes.push(decodeNode(field.bytes));
  }
  if (!fields || !nodes.length) throw new Error('Not a TensorFlow GraphDef');
  return { nodes };
}
