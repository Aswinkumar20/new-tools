import { paintCadCanvasBackground, type CadCanvasTheme } from './cad-file.utils';

/** Shared CAD 3D wireframe helpers (no parser coupling). */

export interface Cad3dPoint {
  x: number;
  y: number;
  z: number;
}

export interface Cad3dView {
  rotX: number;
  rotY: number;
  zoom: number;
  panX: number;
  panY: number;
}

export interface Cad3dSolid {
  id: string;
  name: string;
  kind: string;
  colorHex: string;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  h: number;
}

export function defaultCad3dView(): Cad3dView {
  return { rotX: 0.48, rotY: 0.72, zoom: 1, panX: 0, panY: 0 };
}

/** Hit-test projected solid centers. Returns the nearest id within `maxPx`, or null. */
export function pickCad3dSolidAtScreen(
  solids: Cad3dSolid[],
  view: Cad3dView,
  width: number,
  height: number,
  sx: number,
  sy: number,
  maxPx = 28
): string | null {
  let bestId: string | null = null;
  let best = maxPx;
  for (const s of solids) {
    const p = projectCad3d({ x: s.cx, y: s.cy, z: s.cz }, view, width, height);
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < best) {
      best = d;
      bestId = s.id;
    }
  }
  return bestId;
}

function rotate(p: Cad3dPoint, rotX: number, rotY: number): Cad3dPoint {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = p.x * cosY - p.z * sinY;
  const z1 = p.x * sinY + p.z * cosY;
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;
  return { x: x1, y: y2, z: z2 };
}

export function projectCad3d(p: Cad3dPoint, view: Cad3dView, width: number, height: number): { x: number; y: number; z: number } {
  const r = rotate(p, view.rotX, view.rotY);
  const scale = Math.max(12, Math.min(width, height) * 0.42) * Math.max(0.08, view.zoom);
  return {
    x: width / 2 + r.x * scale + view.panX,
    y: height / 2 - r.y * scale + view.panY,
    z: r.z
  };
}

function boxCorners(s: Cad3dSolid): Cad3dPoint[] {
  const hx = (s.sx || 1) / 2;
  const hy = (s.sy || 1) / 2;
  const hz = (s.sz || s.h || 1) / 2;
  const { cx, cy, cz } = s;
  return [
    { x: cx - hx, y: cy - hy, z: cz - hz },
    { x: cx + hx, y: cy - hy, z: cz - hz },
    { x: cx + hx, y: cy + hy, z: cz - hz },
    { x: cx - hx, y: cy + hy, z: cz - hz },
    { x: cx - hx, y: cy - hy, z: cz + hz },
    { x: cx + hx, y: cy - hy, z: cz + hz },
    { x: cx + hx, y: cy + hy, z: cz + hz },
    { x: cx - hx, y: cy + hy, z: cz + hz }
  ];
}

function solidPoints(s: Cad3dSolid): Cad3dPoint[] {
  const kind = s.kind.toLowerCase();
  if (kind === 'cylinder') {
    const n = 12;
    const r = Math.max(0.05, s.r || Math.min(s.sx, s.sy) / 2 || 0.35);
    const h = Math.max(0.05, s.h || s.sz || 1);
    const pts: Cad3dPoint[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: s.cx + Math.cos(a) * r, y: s.cy + Math.sin(a) * r, z: s.cz - h / 2 });
      pts.push({ x: s.cx + Math.cos(a) * r, y: s.cy + Math.sin(a) * r, z: s.cz + h / 2 });
    }
    return pts;
  }
  if (kind === 'sphere') {
    const r = Math.max(0.05, s.r || Math.max(s.sx, s.sy, s.sz) / 2 || 0.5);
    const pts: Cad3dPoint[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push({ x: s.cx + Math.cos(a) * r, y: s.cy + Math.sin(a) * r, z: s.cz });
      pts.push({ x: s.cx + Math.cos(a) * r, y: s.cy, z: s.cz + Math.sin(a) * r });
      pts.push({ x: s.cx, y: s.cy + Math.cos(a) * r, z: s.cz + Math.sin(a) * r });
    }
    return pts;
  }
  if (kind === 'plane' || kind === 'surface') {
    const hx = (s.sx || 1) / 2;
    const hy = (s.sy || 1) / 2;
    return [
      { x: s.cx - hx, y: s.cy - hy, z: s.cz },
      { x: s.cx + hx, y: s.cy - hy, z: s.cz },
      { x: s.cx + hx, y: s.cy + hy, z: s.cz },
      { x: s.cx - hx, y: s.cy + hy, z: s.cz }
    ];
  }
  return boxCorners(s);
}

export function solidBBox(solids: Cad3dSolid[]): { min: Cad3dPoint; max: Cad3dPoint } {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const s of solids) {
    for (const p of solidPoints(s)) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }
  }
  if (!Number.isFinite(minX)) return { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

export function fitCad3dView(solids: Cad3dSolid[], width: number, height: number): Cad3dView {
  const box = solidBBox(solids);
  const span = Math.max(1e-3, box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
  const base = Math.max(12, Math.min(width, height) * 0.42);
  const target = Math.max(80, Math.min(width, height) * 0.62);
  const zoom = Math.max(0.12, Math.min(4, target / (span * base)));
  return { rotX: 0.48, rotY: 0.72, zoom, panX: 0, panY: 0 };
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  pairs: Array<[number, number]>,
  selected: boolean,
  selectionColor: string
): void {
  ctx.beginPath();
  for (const [a, b] of pairs) {
    const pa = pts[a];
    const pb = pts[b];
    if (!pa || !pb) continue;
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();
  if (selected && pts.length) {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    ctx.strokeStyle = selectionColor;
    ctx.strokeRect(minX - 4, minY - 4, Math.max(...xs) - minX + 8, Math.max(...ys) - minY + 8);
  }
}

export function renderCad3d(
  canvas: HTMLCanvasElement,
  solids: Cad3dSolid[],
  selectedId: string | null,
  view: Cad3dView,
  emptyLabel = 'No 3D solids in this dump.',
  theme?: Partial<CadCanvasTheme> | 'light' | 'dark'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const colors = paintCadCanvasBackground(ctx, canvas, theme);
  if (!solids.length) {
    ctx.fillStyle = colors.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText(emptyLabel, 16, 28);
    return;
  }
  const w = canvas.width;
  const h = canvas.height;
  const ordered = [...solids].sort((a, b) => {
    const za = projectCad3d({ x: a.cx, y: a.cy, z: a.cz }, view, w, h).z;
    const zb = projectCad3d({ x: b.cx, y: b.cy, z: b.cz }, view, w, h).z;
    return za - zb;
  });
  for (const s of ordered) {
    const selected = s.id === selectedId;
    ctx.strokeStyle = s.colorHex || colors.muted;
    ctx.lineWidth = selected ? 2.4 : 1.35;
    const kind = s.kind.toLowerCase();
    if (kind === 'cylinder') {
      const n = 12;
      const r = Math.max(0.05, s.r || 0.35);
      const hh = Math.max(0.05, s.h || s.sz || 1);
      const bot: Cad3dPoint[] = [];
      const top: Cad3dPoint[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        bot.push({ x: s.cx + Math.cos(a) * r, y: s.cy + Math.sin(a) * r, z: s.cz - hh / 2 });
        top.push({ x: s.cx + Math.cos(a) * r, y: s.cy + Math.sin(a) * r, z: s.cz + hh / 2 });
      }
      const sb = bot.map((p) => projectCad3d(p, view, w, h));
      const st = top.map((p) => projectCad3d(p, view, w, h));
      ctx.beginPath();
      sb.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      st.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < n; i += 2) {
        ctx.moveTo(sb[i].x, sb[i].y);
        ctx.lineTo(st[i].x, st[i].y);
      }
      ctx.stroke();
      if (selected) {
        ctx.strokeStyle = colors.selection;
        ctx.strokeRect(sb[0].x - 6, sb[0].y - 6, 12, 12);
      }
      continue;
    }
    if (kind === 'plane' || kind === 'surface') {
      const pts = solidPoints(s).map((p) => projectCad3d(p, view, w, h));
      drawEdges(ctx, pts, [[0, 1], [1, 2], [2, 3], [3, 0]], selected, colors.selection);
      continue;
    }
    if (kind === 'sphere') {
      const pts = solidPoints(s).map((p) => projectCad3d(p, view, w, h));
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      if (selected) {
        ctx.strokeStyle = colors.selection;
        ctx.strokeRect(pts[0].x - 6, pts[0].y - 6, 12, 12);
      }
      continue;
    }
    const corners = boxCorners(s).map((p) => projectCad3d(p, view, w, h));
    drawEdges(
      ctx,
      corners,
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7]
      ],
      selected,
      colors.selection
    );
  }
  ctx.fillStyle = colors.hint;
  ctx.font = '11px sans-serif';
  ctx.fillText('Drag to rotate · click to select · wheel zoom · Fit', 12, h - 12);
}

export { resolveCadCanvasTheme } from './cad-file.utils';
