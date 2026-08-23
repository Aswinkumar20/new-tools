import type { XmAttribute, XmNode } from '../types/xml-viewer.types';

export function xmNodeColor(name: string, index: number): string {
  const n = name.toLowerCase();
  if (n.includes('order')) return '#a5b4fc';
  if (n.includes('note') || n.includes('text')) return '#c7d2fe';
  if (n.includes('shop') || n.includes('root')) return '#818cf8';
  const colors = ['#818cf8', '#6366f1', '#4f46e5', '#a5b4fc', '#c7d2fe'];
  return colors[index % colors.length];
}

export function renderXmNodes(canvas: HTMLCanvasElement, nodes: XmNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No elements in this XML tree.', 16, 28);
    return;
  }
  const visible = nodes.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((n, i) => {
    const y = 14 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    const x = 16 + Math.min(8, n.depth) * 10;
    ctx.fillStyle = xmNodeColor(n.name, i);
    ctx.fillRect(x, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`<${n.name}> · ${n.attrCount} attrs · ${n.childCount} children`.slice(0, 80), x + 16, y + 10);
  });
}

export function renderXmAttributes(canvas: HTMLCanvasElement, attrs: XmAttribute[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!attrs.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No attributes in this XML document.', 16, 28);
    return;
  }
  const visible = attrs.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((a, i) => {
    const y = 14 + i * rowH;
    if (a.id === selectedId) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = xmNodeColor(a.name, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${a.ownerName}@${a.name}="${a.value}"`.slice(0, 84), 32, y + 10);
  });
}

export function renderXmPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#a5b4fc';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
