import type { JnNode, JnSchemaEntry } from '../types/json-viewer.types';

export function jnTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'object') return '#fcd34d';
  if (t === 'array') return '#fdba74';
  if (t === 'number') return '#fde68a';
  if (t === 'boolean') return '#fef08a';
  if (t === 'null') return '#e2e8f0';
  if (t === 'string') return '#fed7aa';
  const colors = ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fde68a'];
  return colors[index % colors.length];
}

export function renderJnTree(canvas: HTMLCanvasElement, nodes: JnNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No nodes in this JSON tree.', 16, 28);
    return;
  }
  const visible = nodes.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((n, i) => {
    const y = 14 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    const x = 16 + Math.min(8, n.depth) * 10;
    ctx.fillStyle = jnTypeColor(n.type, i);
    ctx.fillRect(x, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.type} · ${n.value}`.slice(0, 80), x + 16, y + 10);
  });
}

export function renderJnSchema(canvas: HTMLCanvasElement, schema: JnSchemaEntry[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!schema.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No schema paths in this JSON document.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / schema.length));
  schema.forEach((s, i) => {
    const y = 16 + i * rowH;
    if (s.id === selectedId) {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = jnTypeColor(s.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${s.path} · ${s.type}${s.nullable ? ' | null' : ''}`.slice(0, 84), 36, y + 11);
  });
}

export function renderJnPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(217, 119, 6, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#fcd34d';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
