/** Build a minimal SEG-Y Rev 1 sample (IEEE float32, big-endian). */

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

function padCard(text: string): string {
  return text.slice(0, 80).padEnd(80, ' ');
}

function writeI16(view: DataView, offset: number, value: number): void {
  view.setInt16(offset, value, false);
}

function writeI32(view: DataView, offset: number, value: number): void {
  view.setInt32(offset, value, false);
}

function ricker(t: number, f: number): number {
  const piF = Math.PI * f * t;
  const a = piF * piF;
  return (1 - 2 * a) * Math.exp(-a);
}

export function buildSampleSegyBytes(): Uint8Array {
  const nTraces = 80;
  const ns = 200;
  const dtUs = 2000;
  const cards: string[] = [];
  cards.push(padCard('C 1 CLIENT EasyToolHub SAMPLE 2D SEISMIC LINE'));
  cards.push(padCard('C 2 LINE ETH-DEMO-01  AREA EDUCATION PREVIEW'));
  cards.push(padCard('C 3 FORMAT IEEE FLOAT32  REV1  DT 2MS  NS 200'));
  cards.push(padCard('C 4 SYNTHETIC DIPPING REFLECTOR + RICKER 30HZ'));
  for (let i = cards.length; i < 40; i++) {
    cards.push(padCard(`C${String(i + 1).padStart(2, ' ')}`));
  }
  const textHeader = new TextEncoder().encode(cards.join(''));

  const binary = new Uint8Array(400);
  const bview = new DataView(binary.buffer);
  writeI32(bview, 0, 1); // job id
  writeI32(bview, 4, 1); // line number
  writeI32(bview, 8, 80); // reel traces
  writeI16(bview, 16, dtUs);
  writeI16(bview, 18, dtUs);
  writeI16(bview, 20, ns);
  writeI16(bview, 22, ns);
  writeI16(bview, 24, 5); // IEEE float
  writeI16(bview, 26, 1); // ensemble fold
  writeI16(bview, 300, 0x0100); // rev 1
  writeI16(bview, 302, 1); // fixed length traces

  const traces: Uint8Array[] = [];
  const dt = dtUs / 1e6;
  for (let t = 0; t < nTraces; t++) {
    const header = new Uint8Array(240);
    const hview = new DataView(header.buffer);
    writeI32(hview, 0, t + 1);
    writeI32(hview, 8, 1);
    writeI32(hview, 20, t + 1); // CDP
    writeI32(hview, 72, 1000 + t * 25); // source X
    writeI32(hview, 76, 500);
    writeI32(hview, 80, 1000 + t * 25);
    writeI32(hview, 84, 500);
    writeI16(hview, 114, ns);
    writeI16(hview, 116, dtUs);
    writeI32(hview, 188, t + 1); // inline-ish
    writeI32(hview, 192, 1);

    const samples = new Uint8Array(ns * 4);
    const sview = new DataView(samples.buffer);
    const dip = 0.18 + t * 0.0045;
    for (let i = 0; i < ns; i++) {
      const time = i * dt;
      const noise = (Math.sin(t * 12.7 + i * 0.31) + Math.sin(t * 3.1 + i * 1.7)) * 0.04;
      const primary = ricker(time - dip, 30) * 1.15;
      const multiple = ricker(time - dip * 1.55, 22) * -0.35;
      sview.setFloat32(i * 4, primary + multiple + noise, false);
    }
    traces.push(concat([header, samples]));
  }

  return concat([textHeader, binary, ...traces]);
}
