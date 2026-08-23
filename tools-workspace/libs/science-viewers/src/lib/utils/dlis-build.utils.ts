/** Build a minimal RECORD-structured education DLIS (RP66-like) sample. */

function padAscii(text: string, width: number): string {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(width);
  out.fill(0x20);
  out.set(bytes.slice(0, width));
  return new TextDecoder().decode(out);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function visibleRecord(type: number, payload: Uint8Array, attributes: number): Uint8Array {
  const length = 4 + payload.length;
  if (length > 0xffff) throw new Error('Visible record too large');
  const out = new Uint8Array(length);
  out[0] = (length >> 8) & 0xff;
  out[1] = length & 0xff;
  out[2] = attributes;
  out[3] = type;
  out.set(payload, 4);
  return out;
}

function textPayload(text: string): Uint8Array {
  return new TextEncoder().encode(text.endsWith('\n') ? text : `${text}\n`);
}

function sampleFrameFloats(): Float32Array {
  const strt = 100;
  const stop = 140;
  const step = 0.5;
  const rows: number[][] = [];
  for (let d = strt; d <= stop + 1e-9; d += step) {
    const t = (d - strt) / (stop - strt);
    const shale = d > 118 && d < 126 ? 1 : 0;
    const gr = 42 + 28 * Math.sin(t * 7.2) + 12 * Math.sin(t * 19) + shale * 38;
    const rhob = 2.38 + 0.12 * Math.cos(t * 6.1) - shale * 0.14;
    const nphi = 0.18 - 0.07 * Math.cos(t * 6.1) + shale * 0.09;
    const dt = 78 + 14 * Math.sin(t * 5.4) + shale * 16;
    rows.push([d, gr, rhob, nphi, dt]);
  }
  const out = new Float32Array(rows.length * 5);
  let i = 0;
  for (const row of rows) {
    for (const v of row) out[i++] = v;
  }
  return out;
}

export function buildSampleDlisBytes(): Uint8Array {
  const sul = new TextEncoder().encode(
    padAscii('   1', 4) + padAscii('V1.00', 5) + padAscii('RECORD', 6) + padAscii('8192', 5) + padAscii('EasyToolHub sample well DLIS', 60)
  );
  const header = visibleRecord(
    0,
    textPayload('FILE-HEADER\nID=ETH.DLIS\nSEQUENCE=1\nPRODUCER=EasyToolHub'),
    0x80
  );
  const origin = visibleRecord(
    1,
    textPayload('ORIGIN\nFILE-ID=ETH001\nWELL=SAMPLE-1\nCOMPANY=EasyToolHub\nFIELD=DEMO FIELD\nLOCATION=Education preview'),
    0x80
  );
  const channels = visibleRecord(
    3,
    textPayload(
      [
        'CHANNEL',
        'DEPT|M|DEPTH|F4',
        'GR|GAPI|GAMMA RAY|F4',
        'RHOB|G/C3|BULK DENSITY|F4',
        'NPHI|V/V|NEUTRON POROSITY|F4',
        'DT|US/F|SONIC SLOWNESS|F4'
      ].join('\n')
    ),
    0x80
  );
  const frame = visibleRecord(
    4,
    textPayload('FRAME\nNAME=60MS\nINDEX=DEPT\nCHANNELS=DEPT,GR,RHOB,NPHI,DT'),
    0x80
  );
  const floats = sampleFrameFloats();
  const payload = new Uint8Array(floats.length * 4);
  const view = new DataView(payload.buffer);
  for (let i = 0; i < floats.length; i++) view.setFloat32(i * 4, floats[i], false);
  const data = visibleRecord(0, payload, 0x00);
  return concat([sul, header, origin, channels, frame, data]);
}
