import type { PacketAnalyzerDataset, PacketAnalyzerPacket } from '../types/packet-analyzer.types';
import { decodePcapFrame, filterPcapPackets, isPcapngMagic, parsePcapBytes } from './pcap-parse.utils';
import { enrichPackets, hexDumpToPacket, parseHexDumpText } from './packet-dissect.utils';

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 64));
  let printable = 0;
  for (const b of sample) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)) printable += 1;
  }
  return printable / Math.max(sample.length, 1) > 0.85;
}

export function parsePacketAnalyzerBytes(bytes: Uint8Array, fileName = ''): PacketAnalyzerDataset {
  if (!bytes.length) throw new Error('Packet file is empty');
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (isPcapngMagic(bytes) || (bytes.length >= 4 && (bytes[0] === 0xd4 || bytes[0] === 0xa1)) || /\.(pcap|cap|pcapng)$/i.test(fileName)) {
    try {
      const parsed = parsePcapBytes(bytes);
      return {
        format: parsed.format,
        linkType: parsed.linkType,
        linkTypeName: parsed.linkTypeName,
        packets: enrichPackets(parsed.packets, parsed.linkType),
        warnings: parsed.warnings
      };
    } catch (error) {
      if (!/\.(hex|txt|dump)$/i.test(fileName)) throw error;
    }
  }
  if (looksLikeText(bytes) || ['hex', 'txt', 'dump'].includes(ext)) {
    const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
    const frame = parseHexDumpText(text);
    const packet = hexDumpToPacket(frame);
    return {
      format: 'hex',
      linkType: 1,
      linkTypeName: 'Ethernet',
      packets: [packet],
      warnings: frame.length < 60 ? ['Hex dump frame is shorter than a typical Ethernet packet.'] : []
    };
  }
  const parsed = parsePcapBytes(bytes);
  return {
    format: parsed.format,
    linkType: parsed.linkType,
    linkTypeName: parsed.linkTypeName,
    packets: enrichPackets(parsed.packets, parsed.linkType),
    warnings: parsed.warnings
  };
}

export function filterAnalyzerPackets(packets: PacketAnalyzerPacket[], query: string): PacketAnalyzerPacket[] {
  return filterPcapPackets(packets, query) as PacketAnalyzerPacket[];
}

export { decodePcapFrame, parseHexDumpText };
