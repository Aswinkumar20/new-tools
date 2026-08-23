import type { YlIssue, YlNode } from '../types/yaml-viewer.types';

export function ylTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'object') return '#f9a8d4';
  if (t === 'array') return '#f472b6';
  if (t === 'number') return '#fbcfe8';
  if (t === 'boolean') return '#fce7f3';
  if (t === 'null') return '#e2e8f0';
  if (t === 'string') return '#fbcfe8';
  if (t === 'error') return '#fca5a5';
  if (t === 'warning') return '#fde68a';
  const colors = ['#f472b6', '#ec4899', '#be185d', '#f9a8d4', '#fbcfe8'];
  return colors[index % colors.length];
}

export function renderYlTree(canvas: HTMLCanvasElement, nodes: YlNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No nodes in this YAML tree.', 16, 28);
    return;
  }
  const visible = nodes.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((n, i) => {
    const y = 14 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    const x = 16 + Math.min(8, n.depth) * 10;
    ctx.fillStyle = ylTypeColor(n.type, i);
    ctx.fillRect(x, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.type} · ${n.value}`.slice(0, 80), x + 16, y + 10);
  });
}

export function renderYlValidate(canvas: HTMLCanvasElement, issues: YlIssue[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!issues.length) {
    ctx.fillStyle = '#86efac';
    ctx.font = '13px sans-serif';
    ctx.fillText('Valid YAML — no errors or warnings.', 16, 28);
    return;
  }
  const visible = issues.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((issue, i) => {
    const y = 14 + i * rowH;
    if (issue.id === selectedId) {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = ylTypeColor(issue.severity, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${issue.severity} · ${issue.code} · ${issue.message}`.slice(0, 84), 32, y + 10);
  });
}

export function renderYlPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(190, 24, 93, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#f9a8d4';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
