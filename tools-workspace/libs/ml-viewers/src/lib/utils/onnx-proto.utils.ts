/** Minimal protobuf wire codec for ONNX ModelProto (subset, no npm deps). */

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

export class ProtoWriter {
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

  int64(field: number, value: number): this {
    this.tag(field, 0);
    return this.varint(value);
  }

  str(field: number, value: string): this {
    if (!value) return this;
    const bytes = te.encode(value);
    this.tag(field, 2);
    this.varint(bytes.length);
    this.out.push(...bytes);
    return this;
  }

  bytes(field: number, value: Uint8Array): this {
    this.tag(field, 2);
    this.varint(value.length);
    this.out.push(...value);
    return this;
  }

  msg(field: number, child: Uint8Array): this {
    return this.bytes(field, child);
  }

  float32(field: number, value: number): this {
    this.tag(field, 5);
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    this.out.push(...new Uint8Array(buf));
    return this;
  }

  finish(): Uint8Array {
    return new Uint8Array(this.out);
  }
}

export interface ProtoField {
  field: number;
  wire: number;
  varint: number;
  bytes: Uint8Array;
  float32: number;
}

export class ProtoReader {
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

  next(): ProtoField | null {
    if (this.offset >= this.end) return null;
    const key = this.readVarint();
    const field = key >>> 3;
    const wire = key & 7;
    if (wire === 0) {
      const varint = this.readVarint();
      return { field, wire, varint, bytes: new Uint8Array(0), float32: 0 };
    }
    if (wire === 2) {
      const len = this.readVarint();
      const start = this.offset;
      this.offset += len;
      if (this.offset > this.end) throw new Error('Truncated protobuf bytes');
      return { field, wire, varint: 0, bytes: this.bytes.subarray(start, start + len), float32: 0 };
    }
    if (wire === 5) {
      if (this.offset + 4 > this.end) throw new Error('Truncated protobuf float');
      const float32 = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4).getFloat32(0, true);
      this.offset += 4;
      return { field, wire, varint: 0, bytes: new Uint8Array(0), float32 };
    }
    if (wire === 1) {
      this.offset += 8;
      if (this.offset > this.end) throw new Error('Truncated protobuf fixed64');
      return { field, wire, varint: 0, bytes: new Uint8Array(0), float32: 0 };
    }
    throw new Error(`Unsupported protobuf wire type ${wire}`);
  }

  static decodeString(bytes: Uint8Array): string {
    return td.decode(bytes);
  }
}

const DTYPE: Record<number, string> = {
  1: 'FLOAT',
  2: 'UINT8',
  3: 'INT8',
  4: 'UINT16',
  5: 'INT16',
  6: 'INT32',
  7: 'INT64',
  9: 'BOOL',
  10: 'FLOAT16',
  11: 'DOUBLE',
  12: 'UINT32',
  13: 'UINT64',
  16: 'BFLOAT16'
};

export function dtypeName(code: number): string {
  return DTYPE[code] || `TYPE_${code || 0}`;
}

export function dtypeCode(name: string): number {
  const upper = name.toUpperCase();
  for (const [code, label] of Object.entries(DTYPE)) {
    if (label === upper) return Number(code);
  }
  return 1;
}

export function encodeValueInfo(name: string, dtype: number, shape: number[]): Uint8Array {
  const dims = new ProtoWriter();
  for (const dim of shape) {
    const dimMsg = new ProtoWriter().int64(1, dim).finish();
    dims.msg(1, dimMsg);
  }
  const tensorType = new ProtoWriter().int64(1, dtype).msg(2, dims.finish()).finish();
  const typeMsg = new ProtoWriter().msg(1, tensorType).finish();
  return new ProtoWriter().str(1, name).msg(2, typeMsg).finish();
}

export function encodeTensor(name: string, dtype: number, shape: number[], floats?: number[]): Uint8Array {
  const w = new ProtoWriter();
  for (const dim of shape) w.int64(1, dim);
  w.int64(2, dtype);
  if (floats?.length) {
    for (const value of floats.slice(0, 8)) w.float32(4, value);
  }
  w.str(8, name);
  return w.finish();
}

export function encodeNode(name: string, opType: string, inputs: string[], outputs: string[]): Uint8Array {
  const w = new ProtoWriter();
  for (const input of inputs) w.str(1, input);
  for (const output of outputs) w.str(2, output);
  w.str(3, name).str(4, opType);
  return w.finish();
}

export function encodeOpset(version: number, domain = ''): Uint8Array {
  const w = new ProtoWriter();
  if (domain) w.str(1, domain);
  w.int64(2, version);
  return w.finish();
}

export interface DecodedValueInfo {
  name: string;
  dtype: string;
  shape: number[];
}

export interface DecodedTensor {
  name: string;
  dtype: string;
  shape: number[];
  preview: string;
}

export interface DecodedNode {
  name: string;
  opType: string;
  domain: string;
  inputs: string[];
  outputs: string[];
}

export interface DecodedOnnxModel {
  irVersion: string;
  producerName: string;
  producerVersion: string;
  domain: string;
  modelVersion: string;
  docString: string;
  opset: string;
  graphName: string;
  nodes: DecodedNode[];
  initializers: DecodedTensor[];
  inputs: DecodedValueInfo[];
  outputs: DecodedValueInfo[];
}

function decodeValueInfo(bytes: Uint8Array): DecodedValueInfo {
  const reader = new ProtoReader(bytes);
  let name = '';
  let dtype = 'FLOAT';
  const shape: number[] = [];
  while (reader.remaining) {
    const field = reader.next();
    if (!field) break;
    if (field.field === 1 && field.wire === 2) name = ProtoReader.decodeString(field.bytes);
    if (field.field === 2 && field.wire === 2) {
      const typeReader = new ProtoReader(field.bytes);
      while (typeReader.remaining) {
        const t = typeReader.next();
        if (!t) break;
        if (t.field === 1 && t.wire === 2) {
          const tensorReader = new ProtoReader(t.bytes);
          while (tensorReader.remaining) {
            const s = tensorReader.next();
            if (!s) break;
            if (s.field === 1 && s.wire === 0) dtype = dtypeName(s.varint);
            if (s.field === 2 && s.wire === 2) {
              const shapeReader = new ProtoReader(s.bytes);
              while (shapeReader.remaining) {
                const d = shapeReader.next();
                if (!d) break;
                if (d.field === 1 && d.wire === 2) {
                  const dimReader = new ProtoReader(d.bytes);
                  while (dimReader.remaining) {
                    const dim = dimReader.next();
                    if (!dim) break;
                    if (dim.field === 1 && dim.wire === 0) shape.push(dim.varint);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return { name, dtype, shape };
}

function decodeTensor(bytes: Uint8Array): DecodedTensor {
  const reader = new ProtoReader(bytes);
  let name = '';
  let dtype = 'FLOAT';
  const shape: number[] = [];
  const floats: number[] = [];
  while (reader.remaining) {
    const field = reader.next();
    if (!field) break;
    if (field.field === 1 && field.wire === 0) shape.push(field.varint);
    if (field.field === 2 && field.wire === 0) dtype = dtypeName(field.varint);
    if (field.field === 4 && field.wire === 5) floats.push(Number(field.float32.toFixed(4)));
    if (field.field === 8 && field.wire === 2) name = ProtoReader.decodeString(field.bytes);
  }
  return { name, dtype, shape, preview: floats.length ? floats.join(',') : '' };
}

function decodeNode(bytes: Uint8Array): DecodedNode {
  const reader = new ProtoReader(bytes);
  const inputs: string[] = [];
  const outputs: string[] = [];
  let name = '';
  let opType = '';
  let domain = '';
  while (reader.remaining) {
    const field = reader.next();
    if (!field) break;
    if (field.field === 1 && field.wire === 2) inputs.push(ProtoReader.decodeString(field.bytes));
    if (field.field === 2 && field.wire === 2) outputs.push(ProtoReader.decodeString(field.bytes));
    if (field.field === 3 && field.wire === 2) name = ProtoReader.decodeString(field.bytes);
    if (field.field === 4 && field.wire === 2) opType = ProtoReader.decodeString(field.bytes);
    if (field.field === 5 && field.wire === 2) domain = ProtoReader.decodeString(field.bytes);
  }
  return { name, opType, domain, inputs, outputs };
}

function decodeGraph(bytes: Uint8Array): Pick<DecodedOnnxModel, 'graphName' | 'nodes' | 'initializers' | 'inputs' | 'outputs'> {
  const reader = new ProtoReader(bytes);
  let graphName = '';
  const nodes: DecodedNode[] = [];
  const initializers: DecodedTensor[] = [];
  const inputs: DecodedValueInfo[] = [];
  const outputs: DecodedValueInfo[] = [];
  while (reader.remaining) {
    const field = reader.next();
    if (!field) break;
    if (field.field === 1 && field.wire === 2) nodes.push(decodeNode(field.bytes));
    if (field.field === 2 && field.wire === 2) graphName = ProtoReader.decodeString(field.bytes);
    if (field.field === 5 && field.wire === 2) initializers.push(decodeTensor(field.bytes));
    if (field.field === 11 && field.wire === 2) inputs.push(decodeValueInfo(field.bytes));
    if (field.field === 12 && field.wire === 2) outputs.push(decodeValueInfo(field.bytes));
  }
  return { graphName, nodes, initializers, inputs, outputs };
}

export function decodeOnnxModel(bytes: Uint8Array): DecodedOnnxModel {
  const reader = new ProtoReader(bytes);
  let irVersion = '';
  let producerName = '';
  let producerVersion = '';
  let domain = '';
  let modelVersion = '';
  let docString = '';
  let opset = '';
  let graph: Pick<DecodedOnnxModel, 'graphName' | 'nodes' | 'initializers' | 'inputs' | 'outputs'> = {
    graphName: '',
    nodes: [],
    initializers: [],
    inputs: [],
    outputs: []
  };
  let fields = 0;
  while (reader.remaining) {
    const field = reader.next();
    if (!field) break;
    fields += 1;
    if (field.field === 1 && field.wire === 0) irVersion = String(field.varint);
    if (field.field === 2 && field.wire === 2) producerName = ProtoReader.decodeString(field.bytes);
    if (field.field === 3 && field.wire === 2) producerVersion = ProtoReader.decodeString(field.bytes);
    if (field.field === 4 && field.wire === 2) domain = ProtoReader.decodeString(field.bytes);
    if (field.field === 5 && field.wire === 0) modelVersion = String(field.varint);
    if (field.field === 6 && field.wire === 2) docString = ProtoReader.decodeString(field.bytes);
    if (field.field === 7 && field.wire === 2) graph = decodeGraph(field.bytes);
    if (field.field === 8 && field.wire === 2) {
      const opReader = new ProtoReader(field.bytes);
      let version = '';
      while (opReader.remaining) {
        const op = opReader.next();
        if (!op) break;
        if (op.field === 2 && op.wire === 0) version = String(op.varint);
      }
      if (version) opset = version;
    }
  }
  if (!fields || (!graph.nodes.length && !irVersion && !producerName)) throw new Error('Not an ONNX ModelProto');
  return {
    irVersion,
    producerName,
    producerVersion,
    domain,
    modelVersion,
    docString,
    opset,
    ...graph
  };
}

export function encodeShopRankerOnnx(): Uint8Array {
  const graph = new ProtoWriter();
  graph.msg(1, encodeNode('gemm1', 'Gemm', ['features', 'W1', 'b1'], ['h1']));
  graph.msg(1, encodeNode('relu1', 'Relu', ['h1'], ['h1a']));
  graph.msg(1, encodeNode('gemm2', 'Gemm', ['h1a', 'W2', 'b2'], ['logits']));
  graph.msg(1, encodeNode('softmax', 'Softmax', ['logits'], ['scores']));
  graph.str(2, 'ShopRanker');
  graph.msg(5, encodeTensor('W1', 1, [4, 8], [0.11, -0.08, 0.22, 0.04]));
  graph.msg(5, encodeTensor('b1', 1, [8], [0.01, 0, 0, 0]));
  graph.msg(5, encodeTensor('W2', 1, [8, 3], [0.15, -0.2, 0.07]));
  graph.msg(5, encodeTensor('b2', 1, [3], [0, 0.02, -0.01]));
  graph.str(10, 'Tiny ranking MLP');
  graph.msg(11, encodeValueInfo('features', 1, [1, 4]));
  graph.msg(12, encodeValueInfo('scores', 1, [1, 3]));

  return new ProtoWriter()
    .int64(1, 8)
    .str(2, 'easytoolhub')
    .str(3, '0.1')
    .str(4, 'shop.ranker')
    .int64(5, 1)
    .str(6, 'Tiny ranking MLP')
    .msg(7, graph.finish())
    .msg(8, encodeOpset(18))
    .finish();
}
