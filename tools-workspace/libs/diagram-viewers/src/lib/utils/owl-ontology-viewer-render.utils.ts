import type { OwlAxiom, OwlClass, OwlProperty } from '../types/owl-ontology-viewer.types';

export function owlNodeColor(kind: string, index: number): string {
  if (kind === 'object') return '#c4b5fd';
  if (kind === 'datatype') return '#6ee7b7';
  if (kind === 'annotation') return '#fcd34d';
  const colors = ['#d8b4fe', '#c084fc', '#a855f7', '#e9d5ff', '#7c3aed'];
  return colors[index % colors.length];
}

export function renderOwlDiagram(
  canvas: HTMLCanvasElement,
  classes: OwlClass[],
  properties: OwlProperty[],
  axioms: OwlAxiom[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!classes.length && !properties.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No classes or properties in this ontology.', 16, 28);
    return;
  }
  const nodes = [
    ...classes.map((c) => ({ id: c.id, name: c.name, kind: 'class', x: c.x, y: c.y })),
    ...properties.map((p) => ({ id: p.id, name: p.name, kind: p.kind, x: p.x, y: p.y }))
  ];
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(nodes.map((n) => [n.id, { x: mapX(n.x), y: mapY(n.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const a of axioms) {
    const s = pos.get(a.source);
    const t = pos.get(a.target);
    if (!s || !t) continue;
    ctx.strokeStyle = a.rel === 'subclass' ? '#c4b5fd' : '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.fillStyle = '#e9d5ff';
    ctx.font = '10px sans-serif';
    ctx.fillText(a.rel, (s.x + t.x) / 2 - 12, (s.y + t.y) / 2 - 4);
  }
  nodes.forEach((node, i) => {
    const p = pos.get(node.id);
    if (!p) return;
    ctx.fillStyle = node.id === selectedId ? '#f3e8ff' : owlNodeColor(node.kind, i);
    ctx.fillRect(p.x - 58, p.y - 18, 116, 36);
    ctx.fillStyle = '#3b0764';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(node.name.slice(0, 16), p.x - 52, p.y - 2);
    ctx.font = '10px sans-serif';
    ctx.fillText(node.kind.slice(0, 18), p.x - 52, p.y + 12);
  });
}

export function renderOwlClasses(canvas: HTMLCanvasElement, classes: OwlClass[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!classes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching classes in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / classes.length));
  classes.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(88, 28, 135, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = owlNodeColor('class', i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name}${c.superClasses.length ? ` ⊏ ${c.superClasses.join(', ')}` : ''}`, 36, y + 11);
  });
}

export function renderOwlProperties(canvas: HTMLCanvasElement, properties: OwlProperty[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!properties.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching properties in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / properties.length));
  properties.forEach((p, i) => {
    const y = 16 + i * rowH;
    if (p.id === selectedId) {
      ctx.fillStyle = 'rgba(88, 28, 135, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = owlNodeColor(p.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${p.name} · ${p.kind}${p.domain || p.range ? ` · ${p.domain || '?'} → ${p.range || '?'}` : ''}`, 36, y + 11);
  });
}

export function renderOwlAxioms(canvas: HTMLCanvasElement, axioms: OwlAxiom[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!axioms.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching axioms in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / axioms.length));
  axioms.forEach((a, i) => {
    const y = 16 + i * rowH;
    if (a.id === selectedId) {
      ctx.fillStyle = 'rgba(88, 28, 135, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#d8b4fe';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${a.sourceName} ${a.rel} ${a.targetName}`, 32, y + 11);
  });
}
