import type { ParsedStratigraphy, StratigraphyColumn, StratigraphyUnit } from '../types/stratigraphy-viewer.types';

function visibleUnits(column: StratigraphyColumn, query: string, visibleIds: Set<string>): StratigraphyUnit[] {
  const q = query.trim().toLowerCase();
  return column.units.filter((u) => {
    if (visibleIds.size && !visibleIds.has(u.id)) return false;
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.lithology.toLowerCase().includes(q) ||
      u.period.toLowerCase().includes(q) ||
      u.era.toLowerCase().includes(q)
    );
  });
}

export function renderStratColumn(
  canvas: HTMLCanvasElement,
  parsed: ParsedStratigraphy,
  options: {
    columnIndex: number;
    query: string;
    visibleIds: Set<string>;
    selectedId: string | null;
    scale: 'thickness' | 'time';
    background?: string;
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const column = parsed.columns[options.columnIndex] ?? parsed.columns[0];
  if (!column) return;
  const units = visibleUnits(column, options.query, options.visibleIds);
  if (!units.length) return;

  const padL = 56;
  const padT = 32;
  const padB = 24;
  const padR = 24;
  const w = Math.min(220, canvas.width - padL - padR);
  const h = canvas.height - padT - padB;
  const x0 = padL + (canvas.width - padL - padR - w) / 2;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(column.name, x0, 18);
  ctx.fillText(options.scale === 'time' ? parsed.timeUnit : parsed.unit, 8, padT);

  const total =
    options.scale === 'time'
      ? units.reduce((s, u) => s + Math.max(0.01, u.ageBase - u.ageTop), 0)
      : units.reduce((s, u) => s + Math.max(0.01, u.thickness), 0);
  let y = padT;
  units.forEach((unit) => {
    const span = options.scale === 'time' ? Math.max(0.01, unit.ageBase - unit.ageTop) : Math.max(0.01, unit.thickness);
    const uh = Math.max(18, (span / total) * h);
    ctx.fillStyle = unit.color;
    ctx.globalAlpha = options.selectedId && options.selectedId !== unit.id ? 0.45 : 0.95;
    ctx.fillRect(x0, y, w, uh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = options.selectedId === unit.id ? '#f8fafc' : 'rgba(15,23,42,0.35)';
    ctx.lineWidth = options.selectedId === unit.id ? 2 : 1;
    ctx.strokeRect(x0, y, w, uh);
    ctx.lineWidth = 1;
    if (unit.unconformity) {
      ctx.strokeStyle = '#f43f5e';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#0f172a';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(unit.name, x0 + 8, y + Math.min(16, uh / 2 + 4));
    if (uh > 28) {
      ctx.fillStyle = 'rgba(15,23,42,0.75)';
      ctx.fillText(unit.period || unit.lithology, x0 + 8, y + 28);
    }
    y += uh;
  });

  parsed.markers.forEach((m) => {
    if (options.scale !== 'time') return;
    const ageSpan = parsed.ageMax - parsed.ageMin || 1;
    const my = padT + ((m.age - parsed.ageMin) / ageSpan) * h;
    if (my < padT || my > padT + h) return;
    ctx.strokeStyle = '#fbbf24';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x0 - 8, my);
    ctx.lineTo(x0 + w + 8, my);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fde68a';
    ctx.fillText(m.name, x0 + w + 10, my - 2);
  });
}

export function renderStratCorrelation(
  canvas: HTMLCanvasElement,
  parsed: ParsedStratigraphy,
  options: {
    query: string;
    visibleIds: Set<string>;
    selectedId: string | null;
    scale: 'thickness' | 'time';
    background?: string;
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cols = parsed.columns.slice(0, 4);
  if (!cols.length) return;
  const padL = 40;
  const padT = 36;
  const padB = 24;
  const gap = 28;
  const colW = Math.max(70, (canvas.width - padL - 16 - gap * (cols.length - 1)) / cols.length);
  const h = canvas.height - padT - padB;

  const positions: Array<Array<{ unit: StratigraphyUnit; y: number; h: number; x: number }>> = [];
  cols.forEach((column, ci) => {
    const units = visibleUnits(column, options.query, options.visibleIds);
    const total =
      options.scale === 'time'
        ? units.reduce((s, u) => s + Math.max(0.01, u.ageBase - u.ageTop), 0)
        : units.reduce((s, u) => s + Math.max(0.01, u.thickness), 0) || 1;
    const x = padL + ci * (colW + gap);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(column.name, x, 18);
    let y = padT;
    const colPos: Array<{ unit: StratigraphyUnit; y: number; h: number; x: number }> = [];
    units.forEach((unit) => {
      const span = options.scale === 'time' ? Math.max(0.01, unit.ageBase - unit.ageTop) : Math.max(0.01, unit.thickness);
      const uh = Math.max(14, (span / total) * h);
      ctx.fillStyle = unit.color;
      ctx.globalAlpha = options.selectedId && options.selectedId !== unit.id ? 0.4 : 0.95;
      ctx.fillRect(x, y, colW, uh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = options.selectedId === unit.id ? '#f8fafc' : 'rgba(15,23,42,0.3)';
      ctx.strokeRect(x, y, colW, uh);
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(unit.name.slice(0, 16), x + 4, y + Math.min(14, uh / 2 + 4));
      colPos.push({ unit, y, h: uh, x });
      y += uh;
    });
    positions.push(colPos);
  });

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
  for (let ci = 0; ci < positions.length - 1; ci++) {
    for (const a of positions[ci]) {
      const b = positions[ci + 1].find(
        (p) => p.unit.period && a.unit.period && p.unit.period.toLowerCase() === a.unit.period.toLowerCase()
      );
      if (!b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x + colW, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}
