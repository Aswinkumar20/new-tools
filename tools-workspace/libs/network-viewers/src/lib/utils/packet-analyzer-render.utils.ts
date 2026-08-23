import type { PacketLayer } from '../types/packet-analyzer.types';

const LAYER_COLORS: Record<string, string> = {
  Frame: '#64748b',
  Ethernet: '#38bdf8',
  IPv4: '#f59e0b',
  IPv6: '#fb7185',
  TCP: '#22c55e',
  UDP: '#a855f7',
  HTTP: '#4ade80',
  DNS: '#c084fc',
  ARP: '#f97316',
  ICMP: '#94a3b8',
  Payload: '#e2e8f0'
};

export function layerColor(name: string): string {
  return LAYER_COLORS[name] ?? '#e2e8f0';
}

export function renderPacketLayers(canvas: HTMLCanvasElement, layers: PacketLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) return;
  const pad = 24;
  const rowH = Math.min(52, Math.max(36, (canvas.height - pad * 2) / layers.length));
  layers.forEach((layer, i) => {
    const y = pad + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.18)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = layerColor(layer.name);
    ctx.fillRect(pad, y, 8, rowH - 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(layer.name, pad + 18, y + 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(
      `${layer.summary} · off ${layer.offset}+${layer.length}`,
      pad + 18,
      y + 28
    );
  });
}
