/** Build a minimal ROOT file with education histogram + tree metadata. */

function packI32(v: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (v >> 24) & 0xff;
  out[1] = (v >> 16) & 0xff;
  out[2] = (v >> 8) & 0xff;
  out[3] = v & 0xff;
  return out;
}

function packI16(v: number): Uint8Array {
  const out = new Uint8Array(2);
  out[0] = (v >> 8) & 0xff;
  out[1] = v & 0xff;
  return out;
}

function packU32(v: number): Uint8Array {
  return packI32(v >>> 0);
}

function packF64(v: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, v, false);
  return new Uint8Array(buf);
}

function packTString(s: string): Uint8Array {
  const b = new TextEncoder().encode(`${s}\0`);
  const n = b.length;
  const out: number[] = [];
  if (n < 255) out.push(n);
  else out.push(255, (n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  for (const byte of b) out.push(byte);
  while (out.length % 4) out.push(0);
  return new Uint8Array(out);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

function buildHistObject(nbins: number, xmin: number, xmax: number, values: number[]): Uint8Array {
  const arr = new Float64Array(values);
  const arrBytes = new Uint8Array(arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength));
  return concat([
    new TextEncoder().encode('HIST'),
    packI32(1),
    packI32(nbins),
    packF64(xmin),
    packF64(xmax),
    packI32(values.length),
    arrBytes
  ]);
}

function buildTreeObject(branches: Array<{ name: string; type: string }>, rows: string[][]): Uint8Array {
  const branchJson = new TextEncoder().encode(JSON.stringify({ branches, rows }));
  return concat([new TextEncoder().encode('TREE'), packI32(1), packI32(branchJson.length), branchJson]);
}

function keyHeaderLength(className: string, name: string, title: string): number {
  return 32 + packTString(className).length + packTString(name).length + packTString(title).length;
}

function buildKeyRecord(
  className: string,
  name: string,
  title: string,
  objBytes: Uint8Array,
  seekKey: number,
  seekObj: number
): Uint8Array {
  const cls = packTString(className);
  const nm = packTString(name);
  const ttl = packTString(title);
  const keyHeader = concat([
    packI16(4),
    packI16(objBytes.length),
    packU32(0),
    packI32(32 + cls.length + nm.length + ttl.length),
    packI32(1),
    packI32(seekKey),
    packI32(seekObj),
    packI32(0),
    cls,
    nm,
    ttl
  ]);
  const total = 4 + keyHeader.length + objBytes.length;
  return concat([packI32(total), keyHeader, objBytes]);
}

export function buildSampleRootBytes(): Uint8Array {
  const headerSize = 200;
  const nbins = 16;
  const values: number[] = [0];
  for (let i = 1; i <= nbins; i++) {
    values.push(Math.exp(-Math.pow((i - 8) / 2, 2)) * 100);
  }
  values.push(0);

  const histObj = buildHistObject(nbins, 0, 16, values);
  const treeObj = buildTreeObject(
    [
      { name: 'event', type: 'Int32' },
      { name: 'energy', type: 'Float64' },
      { name: 'channel', type: 'Int32' }
    ],
    [
      ['1', '12.4', '3'],
      ['2', '8.1', '1'],
      ['3', '15.7', '2'],
      ['4', '6.3', '1'],
      ['5', '11.0', '3']
    ]
  );

  const histKeyStart = headerSize;
  const histHeaderLen = keyHeaderLength('TH1D', 'energy', 'Sample energy spectrum');
  const histObjStart = histKeyStart + 4 + histHeaderLen;
  const histKey = buildKeyRecord('TH1D', 'energy', 'Sample energy spectrum', histObj, histKeyStart, histObjStart);

  const treeKeyStart = histKeyStart + histKey.length;
  const treeHeaderLen = keyHeaderLength('TTree', 'events', 'Sample event tree');
  const treeObjStart = treeKeyStart + 4 + treeHeaderLen;
  const treeKey = buildKeyRecord('TTree', 'events', 'Sample event tree', treeObj, treeKeyStart, treeObjStart);

  const header = concat([
    new TextEncoder().encode('root'),
    packI32(62209),
    packI32(62209),
    packI32(0),
    packI32(0),
    packI32(headerSize),
    packI32(2),
    packI32(64),
    new Uint8Array([0]),
    packI32(0),
    packI32(0),
    packI32(0)
  ]);

  const body = concat([histKey, treeKey]);
  const file = new Uint8Array(headerSize + body.length);
  file.set(header);
  file.set(body, headerSize);
  file.set(packI32(headerSize), 12);
  file.set(packI32(file.length), 16);
  return file;
}
