import type { PcapPacket } from '../types/pcap-viewer.types';

const PROTO_COLORS: Record<string, string> = {
  TCP: '#38bdf8',
  HTTP: '#22c55e',
  UDP: '#f59e0b',
  DNS: '#a855f7',
  ARP: '#fb7185',
  ICMP: '#94a3b8',
  ETH: '#64748b'
};

export function protocolColor(protocol: string): string {
  return PROTO_COLORS[protocol] ?? '#e2e8f0';
}

export function renderPcapTimeline(
  canvas: HTMLCanvasElement,
  packets: PcapPacket[],
  selectedIndex: number | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!packets.length) return;
  const pad = 28;
  const maxT = Math.max(...packets.map((p) => p.relMs), 1);
  const w = canvas.width - pad * 2;
  const y = canvas.height / 2;
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(pad + w, y);
  ctx.stroke();
  packets.forEach((pkt) => {
    const x = pad + (pkt.relMs / maxT) * w;
    const selected = pkt.index === selectedIndex;
    ctx.fillStyle = protocolColor(pkt.protocol);
    ctx.beginPath();
    ctx.arc(x, y, selected ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('0 ms', pad, canvas.height - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${maxT.toFixed(1)} ms`, pad + w, canvas.height - 10);
  ctx.textAlign = 'left';
}
