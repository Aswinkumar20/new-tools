/** Build a minimal MATLAB MAT v5 file for education samples. */

const MI_INT8 = 1;
const MI_INT32 = 5;
const MI_UINT32 = 6;
const MI_SINGLE = 7;
const MI_DOUBLE = 9;
const MI_MATRIX = 14;

const MX_DOUBLE_CLASS = 6;
const MX_SINGLE_CLASS = 7;

function align8(n: number): number {
  return (8 - (n % 8)) % 8;
}

function packI32(v: number, le: boolean): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, v, le);
  return new Uint8Array(buf);
}

function packU32(v: number, le: boolean): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, v >>> 0, le);
  return new Uint8Array(buf);
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

function writeTag(dtype: number, nbytes: number, data: Uint8Array, le: boolean): Uint8Array {
  if (nbytes <= 4) {
    const tag = new Uint8Array(8);
    tag.set(packI32(dtype, le), 0);
    tag.set(packI32(nbytes, le), 4);
    tag.set(data.subarray(0, 4), 8 - 4);
    return tag;
  }
  const pad = align8(nbytes);
  const out = new Uint8Array(8 + nbytes + pad);
  out.set(packI32(dtype, le), 0);
  out.set(packI32(nbytes, le), 4);
  out.set(data, 8);
  return out;
}

function buildMatrix(
  name: string,
  mxClass: number,
  data: Uint8Array,
  dims: number[],
  dtype: number,
  le: boolean
): Uint8Array {
  const flags = concat([packU32(mxClass, le), packU32(0, le)]);
  const dimData = concat([
    packI32(dims.length, le),
    ...dims.map((d) => packI32(d, le))
  ]);
  const nameBytes = new TextEncoder().encode(`${name}\0`);
  const body = concat([
    writeTag(MI_UINT32, 8, flags, le),
    writeTag(MI_INT32, dimData.length, dimData, le),
    writeTag(MI_INT8, nameBytes.length, nameBytes, le),
    writeTag(dtype, data.length, data, le)
  ]);
  return writeTag(MI_MATRIX, body.length, body, le);
}

export function buildSampleMatV5Bytes(): Uint8Array {
  const le = true;
  const header = new Uint8Array(128);
  const text = 'MATLAB 5.0 MAT-file, Platform: POSIX, Created by EasyToolHub sample';
  header.set(new TextEncoder().encode(text));
  header[126] = 0;
  header[127] = 1;

  const ni = 8;
  const nj = 8;
  const grid = new Float64Array(ni * nj);
  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni; i++) {
      grid[j * ni + i] = i * 1.5 + j * 0.75;
    }
  }
  const series = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    series[i] = Math.sin(i / 4) * 10;
  }

  const gridBytes = new Uint8Array(grid.buffer.slice(grid.byteOffset, grid.byteOffset + grid.byteLength));
  const seriesBytes = new Uint8Array(series.buffer.slice(series.byteOffset, series.byteOffset + series.byteLength));

  return concat([
    header,
    buildMatrix('grid', MX_DOUBLE_CLASS, gridBytes, [ni, nj], MI_DOUBLE, le),
    buildMatrix('series', MX_SINGLE_CLASS, seriesBytes, [1, 16], MI_SINGLE, le)
  ]);
}
