/** Build a minimal GRIB2 message with lat/lon grid and IEEE float data (education sample). */

function u1(v: number): number {
  return v & 0xff;
}

function packU2(v: number): Uint8Array {
  const out = new Uint8Array(2);
  out[0] = (v >> 8) & 0xff;
  out[1] = v & 0xff;
  return out;
}

function packU4(v: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (v >> 24) & 0xff;
  out[1] = (v >> 16) & 0xff;
  out[2] = (v >> 8) & 0xff;
  out[3] = v & 0xff;
  return out;
}

function packI4(v: number): Uint8Array {
  const u = v < 0 ? 0x100000000 + v : v;
  return packU4(u);
}

function packF4(v: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, v, false);
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

function section(num: number, body: Uint8Array): Uint8Array {
  const len = 5 + body.length;
  return concat([packU4(len), new Uint8Array([num]), body]);
}

export interface SampleGribGridOptions {
  ni?: number;
  nj?: number;
  parameterName?: string;
  category?: number;
  parameterNumber?: number;
}

export function buildSampleGrib2Bytes(options: SampleGribGridOptions = {}): Uint8Array {
  const ni = options.ni ?? 8;
  const nj = options.nj ?? 8;
  const count = ni * nj;
  const lat1 = 45;
  const lat2 = 35;
  const lon1 = 0;
  const lon2 = 35;
  const di = Math.round(((lon2 - lon1) / Math.max(ni - 1, 1)) * 1000);
  const dj = Math.round(((lat2 - lat1) / Math.max(nj - 1, 1)) * 1000);
  const values = new Float32Array(count);
  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni; i++) {
      values[j * ni + i] = 280 + i * 0.5 + j * 0.25;
    }
  }

  const sec1 = section(
    1,
    concat([
      packU2(7), // originating centre
      new Uint8Array([4]), // generating process
      new Uint8Array([0]), // grid definition in section 3
      new Uint8Array([0]), // no bitmap
      new Uint8Array([0]), // discipline meteorological
      new Uint8Array([0]) // product definition template 4.0
    ])
  );

  const sec3 = section(
    3,
    concat([
      new Uint8Array([0, 0]), // template 3.0
      packU4(count),
      packI4(Math.round(lat1 * 1000)),
      packU4(Math.round(lon1 * 1000)),
      new Uint8Array([0x30]),
      packI4(Math.round(lat2 * 1000)),
      packU4(Math.round(lon2 * 1000)),
      packU4(di),
      packU4(Math.abs(dj)),
      new Uint8Array([0x40]) // scanning mode
    ])
  );

  const sec4 = section(
    4,
    concat([
      new Uint8Array([0, 0]), // template 4.0
      new Uint8Array([options.category ?? 0]), // temperature category
      new Uint8Array([options.parameterNumber ?? 0]), // TMP
      new Uint8Array([2]), // forecast
      new Uint8Array([0]),
      new Uint8Array([0]),
      packU2(0),
      new Uint8Array([0]),
      new Uint8Array([1]), // hours unit
      packU4(0),
      new Uint8Array([100]), // isobaric surface
      new Uint8Array([0]),
      packI4(85000),
      new Uint8Array([255]),
      new Uint8Array([0]),
      packI4(0)
    ])
  );

  const sec5 = section(5, concat([new Uint8Array([0, 4]), new Uint8Array([1])])); // template 5.4 IEEE single

  const dataBytes = new Uint8Array(values.buffer.slice(values.byteOffset, values.byteOffset + values.byteLength));
  const sec7 = section(7, dataBytes);
  const sec8 = new TextEncoder().encode('7777');

  const body = concat([sec1, sec3, sec4, sec5, sec7, sec8]);
  const totalLen = 16 + body.length;
  const sec0 = concat([
    new TextEncoder().encode('GRIB'),
    new Uint8Array([0, 0]),
    new Uint8Array([0]), // discipline
    new Uint8Array([2]), // edition 2
    (() => {
      const out = new Uint8Array(8);
      let n = totalLen;
      for (let i = 7; i >= 0; i--) {
        out[i] = n & 0xff;
        n = Math.floor(n / 256);
      }
      return out;
    })()
  ]);

  return concat([sec0, body]);
}
