import type { DrlCondition, DrlRule } from '../types/drools-rule-viewer.types';

export function drlRuleColor(index: number): string {
  const colors = ['#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d'];
  return colors[index % colors.length];
}

export function renderDrlDiagram(
  canvas: HTMLCanvasElement,
  rules: DrlRule[],
  conditions: DrlCondition[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rules.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No rules in this Drools file.', 16, 28);
    return;
  }
  const items = [
    ...rules.map((r) => ({ id: r.id, x: r.x, y: r.y })),
    ...conditions.map((c) => ({ id: c.id, x: c.x, y: c.y }))
  ];
  const xs = items.map((n) => n.x);
  const ys = items.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const rulePos = new Map(rules.map((r) => [r.id, { x: mapX(r.x), y: mapY(r.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const c of conditions) {
    const a = rulePos.get(c.ruleId);
    const b = { x: mapX(c.x), y: mapY(c.y) };
    if (!a) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x + 60, a.y);
    ctx.lineTo(b.x - 40, b.y);
    ctx.stroke();
    ctx.fillStyle = '#f9a8d4';
    ctx.font = '10px sans-serif';
    ctx.fillText((c.modifier || c.factType || 'when').slice(0, 14), (a.x + b.x) / 2 - 10, (a.y + b.y) / 2 - 4);
    ctx.fillStyle = selectedId === c.id ? '#fce7f3' : '#f9a8d4';
    ctx.fillRect(b.x - 50, b.y - 14, 100, 28);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText((c.factType || 'cond').slice(0, 12), b.x - 36, b.y + 4);
  }
  rules.forEach((r, i) => {
    const p = rulePos.get(r.id);
    if (!p) return;
    ctx.fillStyle = r.id === selectedId ? '#fce7f3' : drlRuleColor(i);
    ctx.fillRect(p.x - 70, p.y - 22, 140, 44);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(r.name.slice(0, 16), p.x - 54, p.y + 4);
  });
}

export function renderDrlRules(canvas: HTMLCanvasElement, rules: DrlRule[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rules.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching rules in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rules.length));
  rules.forEach((r, i) => {
    const y = 16 + i * rowH;
    if (r.id === selectedId) {
      ctx.fillStyle = 'rgba(159, 18, 57, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = drlRuleColor(i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${r.name}${r.salience ? ` · s${r.salience}` : ''}`, 36, y + 11);
  });
}

export function renderDrlConditions(canvas: HTMLCanvasElement, conditions: DrlCondition[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!conditions.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching conditions in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / conditions.length));
  conditions.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(159, 18, 57, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#f9a8d4';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    const label = `${c.modifier ? `${c.modifier} ` : ''}${c.factType}${c.constraints ? `(${c.constraints})` : ''}`;
    ctx.fillText(label.slice(0, 64), 32, y + 11);
  });
}
