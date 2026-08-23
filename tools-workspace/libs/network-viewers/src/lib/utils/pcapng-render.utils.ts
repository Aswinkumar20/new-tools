import type { PcapngInterface, PcapngPacket } from '../types/pcapng-viewer.types';
import { protocolColor } from './pcap-render.utils';

export function renderPcapngInterfaces(canvas: HTMLCanvasElement, ifaces: PcapngInterface[], selectedId: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!ifaces.length) return;
  const maxBytes = Math.max(...ifaces.map((i) => i.bytes), 1);
  const pad = 24;
  const rowH = 48;
  ifaces.forEach((iface, i) => {
    const y = pad + i * rowH;
    if (iface.id === selectedId) {
      ctx.fillStyle = 'rgba(167, 139, 250, 0.18)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 8);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${iface.name} · ${iface.linkTypeName}${iface.mac ? ` · ${iface.mac}` : ''}`, pad, y + 10);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${iface.packets} pkts · ${iface.bytes} B${iface.speedBps ? ` · ${Math.round(iface.speedBps / 1e6)} Mbps` : ''}`, pad, y + 26);
    const w = ((canvas.width - pad * 2) * iface.bytes) / maxBytes;
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(pad, y + 30, Math.max(iface.bytes ? 4 : 0, w), 8);
  });
}

export function renderPcapngTimeline(canvas: HTMLCanvasElement, packets: PcapngPacket[], selectedIndex: number | null): void {
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
    ctx.fillStyle = protocolColor(pkt.protocol);
    ctx.beginPath();
    ctx.arc(x, y, pkt.index === selectedIndex ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
}
