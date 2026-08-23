/** Build a minimal classic PCAP (Ethernet + IPv4) education sample. */

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

function u8(...values: number[]): Uint8Array {
  return Uint8Array.from(values.map((v) => v & 0xff));
}

function u16be(value: number): Uint8Array {
  return u8((value >> 8) & 0xff, value & 0xff);
}

function u32be(value: number): Uint8Array {
  return u8((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function u32le(value: number): Uint8Array {
  return u8(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function u16le(value: number): Uint8Array {
  return u8(value & 0xff, (value >>> 8) & 0xff);
}

function ip(a: number, b: number, c: number, d: number): Uint8Array {
  return u8(a, b, c, d);
}

function checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    const hi = bytes[i];
    const lo = i + 1 < bytes.length ? bytes[i + 1] : 0;
    sum += (hi << 8) | lo;
  }
  while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
  return ~sum & 0xffff;
}

function ipv4(src: Uint8Array, dst: Uint8Array, protocol: number, payload: Uint8Array, id = 1): Uint8Array {
  const header = new Uint8Array(20);
  header[0] = 0x45;
  header[1] = 0;
  const total = 20 + payload.length;
  header[2] = (total >> 8) & 0xff;
  header[3] = total & 0xff;
  header[4] = (id >> 8) & 0xff;
  header[5] = id & 0xff;
  header[6] = 0x40;
  header[7] = 0;
  header[8] = 64;
  header[9] = protocol;
  header.set(src, 12);
  header.set(dst, 16);
  const csum = checksum(header);
  header[10] = (csum >> 8) & 0xff;
  header[11] = csum & 0xff;
  return concat([header, payload]);
}

function tcp(srcPort: number, dstPort: number, seq: number, ack: number, flags: number, payload: Uint8Array): Uint8Array {
  const header = concat([
    u16be(srcPort),
    u16be(dstPort),
    u32be(seq),
    u32be(ack),
    u16be((5 << 12) | flags),
    u16be(64240),
    u16be(0),
    u16be(0)
  ]);
  return concat([header, payload]);
}

function udp(srcPort: number, dstPort: number, payload: Uint8Array): Uint8Array {
  const len = 8 + payload.length;
  return concat([u16be(srcPort), u16be(dstPort), u16be(len), u16be(0), payload]);
}

function ethernet(dst: Uint8Array, src: Uint8Array, type: number, payload: Uint8Array): Uint8Array {
  return concat([dst, src, u16be(type), payload]);
}

function dnsQuery(): Uint8Array {
  const name = concat([u8(7), new TextEncoder().encode('example'), u8(3), new TextEncoder().encode('com'), u8(0)]);
  return concat([u16be(0x1a2b), u16be(0x0100), u16be(1), u16be(0), u16be(0), u16be(0), name, u16be(1), u16be(1)]);
}

function dnsResponse(): Uint8Array {
  const q = dnsQuery().slice(12);
  const header = concat([u16be(0x1a2b), u16be(0x8180), u16be(1), u16be(1), u16be(0), u16be(0)]);
  const answer = concat([u16be(0xc00c), u16be(1), u16be(1), u32be(60), u16be(4), ip(93, 184, 216, 34)]);
  return concat([header, q, answer]);
}

function pcapGlobalHeader(): Uint8Array {
  return concat([u32le(0xa1b2c3d4), u16le(2), u16le(4), u32le(0), u32le(0), u32le(65535), u32le(1)]);
}

function pcapPacket(tsSec: number, tsUsec: number, frame: Uint8Array): Uint8Array {
  return concat([u32le(tsSec), u32le(tsUsec), u32le(frame.length), u32le(frame.length), frame]);
}

const MAC_A = u8(0x00, 0x11, 0x22, 0x33, 0x44, 0x55);
const MAC_B = u8(0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb);
const IP_CLIENT = ip(10, 0, 0, 10);
const IP_SERVER = ip(93, 184, 216, 34);
const IP_DNS = ip(10, 0, 0, 53);

export function buildSamplePcapBytes(): Uint8Array {
  const base = 1_710_000_000;
  const httpGet = new TextEncoder().encode('GET / HTTP/1.1\r\nHost: example.com\r\nUser-Agent: sample\r\n\r\n');
  const httpOk = new TextEncoder().encode('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 12\r\n\r\nHello world!');
  const arp = concat([
    u16be(1),
    u16be(0x0800),
    u8(6),
    u8(4),
    u16be(1),
    MAC_A,
    IP_CLIENT,
    u8(0, 0, 0, 0, 0, 0),
    IP_SERVER
  ]);

  const frames = [
    ethernet(MAC_B, MAC_A, 0x0800, ipv4(IP_CLIENT, IP_SERVER, 6, tcp(51234, 80, 1000, 0, 0x02, new Uint8Array(0)), 1)),
    ethernet(MAC_A, MAC_B, 0x0800, ipv4(IP_SERVER, IP_CLIENT, 6, tcp(80, 51234, 2000, 1001, 0x12, new Uint8Array(0)), 2)),
    ethernet(MAC_B, MAC_A, 0x0800, ipv4(IP_CLIENT, IP_SERVER, 6, tcp(51234, 80, 1001, 2001, 0x10, new Uint8Array(0)), 3)),
    ethernet(MAC_B, MAC_A, 0x0800, ipv4(IP_CLIENT, IP_SERVER, 6, tcp(51234, 80, 1001, 2001, 0x18, httpGet), 4)),
    ethernet(MAC_A, MAC_B, 0x0800, ipv4(IP_SERVER, IP_CLIENT, 6, tcp(80, 51234, 2001, 1001 + httpGet.length, 0x18, httpOk), 5)),
    ethernet(MAC_B, MAC_A, 0x0800, ipv4(IP_CLIENT, IP_DNS, 17, udp(53001, 53, dnsQuery()), 6)),
    ethernet(MAC_A, MAC_B, 0x0800, ipv4(IP_DNS, IP_CLIENT, 17, udp(53, 53001, dnsResponse()), 7)),
    ethernet(MAC_B, MAC_A, 0x0806, arp)
  ];

  const packets = frames.map((frame, i) => pcapPacket(base, i * 12_000, frame));
  return concat([pcapGlobalHeader(), ...packets]);
}

export function buildSamplePcapngBytes(): Uint8Array {
  return buildSamplePcapngMultiIfaceBytes();
}

export function buildSamplePcapngMultiIfaceBytes(): Uint8Array {
  const pcap = buildSamplePcapBytes();
  const extracted: Array<{ ts: bigint; frame: Uint8Array }> = [];
  let pos = 24;
  while (pos + 16 <= pcap.length) {
    const incl = pcap[pos + 8] | (pcap[pos + 9] << 8) | (pcap[pos + 10] << 16) | (pcap[pos + 11] << 24);
    const tsSec = pcap[pos] | (pcap[pos + 1] << 8) | (pcap[pos + 2] << 16) | (pcap[pos + 3] << 24);
    const tsUsec = pcap[pos + 4] | (pcap[pos + 5] << 8) | (pcap[pos + 6] << 16) | (pcap[pos + 7] << 24);
    const frame = pcap.slice(pos + 16, pos + 16 + incl);
    extracted.push({ ts: BigInt(tsSec) * 1_000_000n + BigInt(tsUsec), frame });
    pos += 16 + incl;
  }
  const epbs = extracted.map((item, i) => buildEpb(i < 5 ? 0 : 1, item.ts, item.frame));
  return concat([
    buildShb([
      option(2, textBytes('SampleNIC DualPort')),
      option(3, textBytes('EasyToolHub OS')),
      option(4, textBytes('pcapng-sample/1.0'))
    ]),
    buildIdb(1, [
      option(2, textBytes('eth0')),
      option(3, textBytes('Wired uplink')),
      option(6, MAC_A),
      option(8, u64le(1_000_000_000)),
      option(9, u8(6))
    ]),
    buildIdb(1, [
      option(2, textBytes('wlan0')),
      option(3, textBytes('Wi-Fi client')),
      option(6, MAC_B),
      option(8, u64le(54_000_000)),
      option(9, u8(6))
    ]),
    ...epbs,
    buildIsb(0, extracted[0]?.ts ?? 0n, extracted[4]?.ts ?? 0n, 5, 0),
    buildIsb(1, extracted[5]?.ts ?? 0n, extracted[7]?.ts ?? 0n, 3, 0)
  ]);
}

function pad4(bytes: Uint8Array): Uint8Array {
  const extra = (4 - (bytes.length % 4)) % 4;
  return extra ? concat([bytes, new Uint8Array(extra)]) : bytes;
}

function block(type: number, body: Uint8Array): Uint8Array {
  const total = 12 + body.length;
  return concat([u32le(type), u32le(total), body, u32le(total)]);
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function u64le(value: number): Uint8Array {
  const hi = Math.floor(value / 0x100000000);
  const lo = value >>> 0;
  return concat([u32le(lo), u32le(hi)]);
}

function option(code: number, value: Uint8Array): Uint8Array {
  return concat([u16le(code), u16le(value.length), pad4(value)]);
}

function endOptions(): Uint8Array {
  return concat([u16le(0), u16le(0)]);
}

function buildShb(options: Uint8Array[] = []): Uint8Array {
  return block(
    0x0a0d0d0a,
    concat([u32le(0x1a2b3c4d), u16le(1), u16le(0), u32le(0xffffffff), u32le(0xffffffff), ...options, endOptions()])
  );
}

function buildIdb(linkType: number, options: Uint8Array[] = []): Uint8Array {
  return block(1, concat([u16le(linkType), u16le(0), u32le(65535), ...options, endOptions()]));
}

function buildIsb(interfaceId: number, startTs: bigint, endTs: bigint, received: number, dropped: number): Uint8Array {
  return block(
    5,
    concat([
      u32le(interfaceId),
      u32le(Number((endTs >> 32n) & 0xffffffffn)),
      u32le(Number(endTs & 0xffffffffn)),
      option(2, u64le(Number(startTs))),
      option(3, u64le(Number(endTs))),
      option(4, u64le(received)),
      option(5, u64le(dropped)),
      endOptions()
    ])
  );
}

function buildEpb(interfaceId: number, ts: bigint, frame: Uint8Array): Uint8Array {
  const high = Number((ts >> 32n) & 0xffffffffn);
  const low = Number(ts & 0xffffffffn);
  const padded = pad4(frame);
  return block(
    6,
    concat([u32le(interfaceId), u32le(high), u32le(low), u32le(frame.length), u32le(frame.length), padded])
  );
}
