import type { BoreholeSurveyRow, ParsedBorehole } from '../types/borehole-viewer.types';

function lithAtMd(parsed: ParsedBorehole, md: number): string {
  const hit = parsed.lithology.find((l) => md >= l.topMd && md <= l.baseMd);
  return hit?.color ?? '#38bdf8';
}

export function renderBoreholePlan(
  canvas: HTMLCanvasElement,
  parsed: ParsedBorehole,
  options: { selectedIndex: number | null; mdMin: number; mdMax: number; background?: string }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const pts = parsed.survey.filter((s) => s.md >= options.mdMin && s.md <= options.mdMax);
  if (pts.length < 2) return;
  const pad = 40;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  const xs = pts.map((p) => p.east);
  const ys = pts.map((p) => p.north);
  const xmin = Math.min(...xs, 0);
  const xmax = Math.max(...xs, 0);
  const ymin = Math.min(...ys, 0);
  const ymax = Math.max(...ys, 0);
  const span = Math.max(xmax - xmin, ymax - ymin, 1);
  const sx = (e: number) => pad + ((e - xmin) / span) * w;
  const sy = (n: number) => pad + h - ((n - ymin) / span) * h;

  ctx.strokeStyle = '#334155';
  ctx.strokeRect(pad, pad, w, h);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('West', pad, canvas.height - 12);
  ctx.fillText('East', pad + w - 28, canvas.height - 12);
  ctx.fillText('N', pad + w / 2 - 4, pad - 8);

  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.east), sy(p.north)) : ctx.lineTo(sx(p.east), sy(p.north))));
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.lineWidth = 1;

  pts.forEach((p) => {
    ctx.fillStyle = lithAtMd(parsed, p.md);
    ctx.beginPath();
    ctx.arc(sx(p.east), sy(p.north), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (options.selectedIndex != null) {
    const sel = parsed.survey[options.selectedIndex];
    if (sel) {
      ctx.strokeStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(sx(sel.east), sy(sel.north), 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function renderBoreholeSection(
  canvas: HTMLCanvasElement,
  parsed: ParsedBorehole,
  options: {
    selectedIndex: number | null;
    mdMin: number;
    mdMax: number;
    exaggeration: number;
    background?: string;
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const pts = parsed.survey.filter((s) => s.md >= options.mdMin && s.md <= options.mdMax);
  if (pts.length < 2) return;
  const padL = 48;
  const padT = 28;
  const padB = 32;
  const padR = 16;
  const w = canvas.width - padL - padR;
  const h = canvas.height - padT - padB;
  const ex = Math.max(0.25, options.exaggeration);
  const vsMin = Math.min(...pts.map((p) => p.vs), 0);
  const vsMax = Math.max(...pts.map((p) => p.vs), 1);
  const tvdMax = Math.max(...pts.map((p) => p.tvd), 1);
  const sx = (vs: number) => padL + ((vs - vsMin) / (vsMax - vsMin || 1)) * w;
  const sy = (tvd: number) => padT + (tvd / (tvdMax / ex || 1)) * h;

  ctx.strokeStyle = '#334155';
  ctx.strokeRect(padL, padT, w, Math.min(h, canvas.height - padT - padB));
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('VS', padL, 16);
  ctx.fillText('TVD ↓', 6, padT + 10);

  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.vs), sy(p.tvd)) : ctx.lineTo(sx(p.vs), sy(p.tvd))));
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.lineWidth = 1;

  parsed.markers.forEach((m) => {
    const st = nearestStation(parsed.survey, m.md);
    if (!st || st.md < options.mdMin || st.md > options.mdMax) return;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(padL, sy(st.tvd));
    ctx.lineTo(padL + w, sy(st.tvd));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fde68a';
    ctx.fillText(m.name, padL + 6, sy(st.tvd) - 4);
  });

  pts.forEach((p) => {
    ctx.fillStyle = lithAtMd(parsed, p.md);
    ctx.beginPath();
    ctx.arc(sx(p.vs), sy(p.tvd), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (options.selectedIndex != null) {
    const sel = parsed.survey[options.selectedIndex];
    if (sel) {
      ctx.strokeStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(sx(sel.vs), sy(sel.tvd), 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function renderBorehole3d(
  canvas: HTMLCanvasElement,
  parsed: ParsedBorehole,
  options: { selectedIndex: number | null; mdMin: number; mdMax: number; exaggeration: number; background?: string }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const pts = parsed.survey.filter((s) => s.md >= options.mdMin && s.md <= options.mdMax);
  if (pts.length < 2) return;
  const pad = 36;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  const ex = Math.max(0.25, options.exaggeration);
  const project = (p: BoreholeSurveyRow) => {
    const x = pad + w * 0.5 + p.east * 0.45 - p.north * 0.35;
    const y = pad + 16 + p.tvd * ex * (h / Math.max(parsed.tvd, 1)) * 0.72 + p.north * 0.12;
    return { x, y };
  };
  const projected = pts.map(project);
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * w;
  const sy = (y: number) => pad + ((y - minY) / (maxY - minY || 1)) * h;

  ctx.strokeStyle = '#1e293b';
  ctx.strokeRect(pad, pad, w, h);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Isometric path (E / N / TVD)', pad, 18);

  ctx.beginPath();
  projected.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.lineWidth = 1;

  pts.forEach((p, i) => {
    ctx.fillStyle = lithAtMd(parsed, p.md);
    ctx.beginPath();
    ctx.arc(sx(projected[i].x), sy(projected[i].y), options.selectedIndex === p.index ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function nearestStation(survey: BoreholeSurveyRow[], md: number): BoreholeSurveyRow | null {
  if (!survey.length) return null;
  let best = survey[0];
  let dist = Math.abs(best.md - md);
  for (const s of survey) {
    const d = Math.abs(s.md - md);
    if (d < dist) {
      best = s;
      dist = d;
    }
  }
  return best;
}
