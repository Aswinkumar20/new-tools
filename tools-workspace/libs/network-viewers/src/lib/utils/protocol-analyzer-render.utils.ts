import type { PcapPacket } from '../types/pcap-viewer.types';
import type { ProtocolDissector } from '../types/protocol-analyzer.types';
import { protocolColor } from './pcap-render.utils';

export function renderProtocolBars(canvas: HTMLCanvasElement, dissectors: ProtocolDissector[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!dissectors.length) return;
  const pad = 20;
  const max = Math.max(...dissectors.map((d) => d.bytes), 1);
  const rowH = Math.min(40, Math.max(24, (canvas.height - pad * 2) / dissectors.length));
  dissectors.forEach((d, i) => {
    const y = pad + i * rowH;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${d.name} (${d.packets})`, pad, y + 12);
    const w = ((canvas.width - pad * 2 - 140) * d.bytes) / max;
    ctx.fillStyle = protocolColor(d.name);
    ctx.fillRect(pad + 130, y, Math.max(d.bytes ? 4 : 0, w), 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(String(d.bytes), pad + 136 + Math.max(w, 0), y + 11);
  });
}

export function renderProtocolTimeline(
  canvas: HTMLCanvasElement,
  packets: PcapPacket[],
  selectedProtocol: string | null,
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
    const dim =
      selectedProtocol &&
      selectedProtocol !== 'Ethernet' &&
      selectedProtocol !== pkt.protocol &&
      !(selectedProtocol === 'TCP' && (pkt.protocol === 'TCP' || pkt.protocol === 'HTTP')) &&
      !(selectedProtocol === 'UDP' && (pkt.protocol === 'UDP' || pkt.protocol === 'DNS')) &&
      !(selectedProtocol === 'IPv4' && pkt.ipVersion === 4) &&
      !(selectedProtocol === 'IPv6' && pkt.ipVersion === 6);
    const x = pad + (pkt.relMs / maxT) * w;
    ctx.globalAlpha = dim ? 0.25 : 1;
    ctx.fillStyle = protocolColor(pkt.protocol);
    ctx.beginPath();
    ctx.arc(x, y, pkt.index === selectedIndex ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('0 ms', pad, canvas.height - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${maxT.toFixed(1)} ms`, pad + w, canvas.height - 10);
  ctx.textAlign = 'left';
}
