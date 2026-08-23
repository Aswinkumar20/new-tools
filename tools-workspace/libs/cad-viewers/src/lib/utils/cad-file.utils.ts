/** Shared CAD-viewer file + drawing helpers (kept local to avoid cross-lib coupling). */

export type { CadDumpRec, CadTableRow } from '../types/cad-common.types';

export function cadBytesToBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface CadCanvasTheme {
  background: string;
  muted: string;
  text: string;
  hint: string;
  selection: string;
}

export interface CadRejectedFile {
  name: string;
  reason: string;
}

export interface CadFileFilterOptions {
  extensions: readonly string[];
  maxBytes: number;
  formatsLabel?: string;
  gzipReason?: string;
  allowGzip?: boolean;
}

export interface CadInsightStats {
  files: number;
  groupLabel: string;
  groupCount: number;
  itemLabel: string;
  itemCount: number;
  sizeLabel: string;
  sizeValue: string;
  warningCount: number;
}

const GROUP_STAT_KEYS: ReadonlyArray<[string, string]> = [
  ['layers', 'Layers'],
  ['products', 'Products'],
  ['sheets', 'Sheets'],
  ['levels', 'Levels'],
  ['storeys', 'Storeys'],
  ['pens', 'Pens'],
  ['systems', 'Systems'],
  ['families', 'Families'],
  ['components', 'Components'],
  ['assemblies', 'Assemblies'],
  ['bodies', 'Bodies'],
  ['cells', 'Cells'],
  ['clashes', 'Clashes'],
  ['disciplines', 'Disciplines'],
  ['nets', 'Nets']
];

const ITEM_STAT_KEYS: ReadonlyArray<[string, string]> = [
  ['entities', 'Entities'],
  ['solids', 'Solids'],
  ['traces', 'Traces'],
  ['features', 'Features'],
  ['elements', 'Elements'],
  ['members', 'Members'],
  ['spaces', 'Spaces'],
  ['commands', 'Commands'],
  ['instances', 'Instances'],
  ['parts', 'Parts'],
  ['boardItems', 'Items'],
  ['coppers', 'Copper'],
  ['surfaces', 'Surfaces'],
  ['groups', 'Groups'],
  ['measurements', 'Meas.']
];

export function readDocumentCadTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function resolveCadCanvasTheme(theme?: Partial<CadCanvasTheme> | 'light' | 'dark'): CadCanvasTheme {
  const mode = theme === 'light' || theme === 'dark' ? theme : readDocumentCadTheme();
  const base: CadCanvasTheme =
    mode === 'dark'
      ? {
          background: '#0f172a',
          muted: '#94a3b8',
          text: '#e2e8f0',
          hint: '#94a3b8',
          selection: '#fde68a'
        }
      : {
          background: '#f1f5f9',
          muted: '#64748b',
          text: '#0f172a',
          hint: '#475569',
          selection: '#c2410c'
        };
  if (theme && typeof theme === 'object') return { ...base, ...theme };
  return base;
}

export function paintCadCanvasBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  theme?: Partial<CadCanvasTheme> | 'light' | 'dark'
): CadCanvasTheme {
  const colors = resolveCadCanvasTheme(theme);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return colors;
}

export function clampCadZoom(value: number, min = 0.05, max = 80): number {
  if (!Number.isFinite(value) || value <= 0) return min;
  return Math.min(max, Math.max(min, value));
}

export function observeCadDocumentTheme(onChange: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function filterValidCadFiles(
  files: FileList | File[],
  options: CadFileFilterOptions
): { accepted: File[]; rejected: CadRejectedFile[] } {
  const accepted: File[] = [];
  const rejected: CadRejectedFile[] = [];
  const seen = new Set<string>();
  const extList = options.extensions.map((ext) => ext.toLowerCase());
  const formats = options.formatsLabel || extList.join(', ');
  const gzipReason = options.gzipReason || 'Compressed files are not supported — decompress first';
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (!options.allowGzip && /\.gz$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: gzipReason });
      continue;
    }
    const ext = getCadFileExtension(file.name);
    if (!extList.includes(ext)) {
      rejected.push({ name: file.name, reason: `Unsupported format (use ${formats})` });
      continue;
    }
    if (!file || file.size <= 0) {
      rejected.push({ name: file.name, reason: 'File is empty' });
      continue;
    }
    if (file.size > options.maxBytes) {
      rejected.push({ name: file.name, reason: `File is too large (max ${formatCadFileSize(options.maxBytes)})` });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

function countNamedArray(parsed: Record<string, unknown> | null | undefined, key: string): number {
  const value = parsed?.[key];
  return Array.isArray(value) ? value.length : 0;
}

export function buildCadInsightStats(
  parsed: Record<string, unknown> | null | undefined,
  fileCount: number,
  currentSize: number | null,
  warnings: string[] | undefined,
  formatSize: (bytes: number) => string
): CadInsightStats {
  let groupLabel = 'Layers';
  let groupCount = 0;
  for (const [key, label] of GROUP_STAT_KEYS) {
    const count = countNamedArray(parsed, key);
    if (count > 0 || (parsed && Array.isArray(parsed[key]))) {
      groupLabel = label;
      groupCount = count;
      break;
    }
  }
  let itemLabel = 'Entities';
  let itemCount = 0;
  for (const [key, label] of ITEM_STAT_KEYS) {
    const count = countNamedArray(parsed, key);
    if (count > 0 || (parsed && Array.isArray(parsed[key]))) {
      itemLabel = label;
      itemCount = count;
      break;
    }
  }
  const warningCount = warnings?.length ?? 0;
  const units = typeof parsed?.['units'] === 'string' && parsed['units'] ? String(parsed['units']) : '';
  const sizeLabel = currentSize != null ? 'Size' : units ? 'Units' : 'Warnings';
  const sizeValue = currentSize != null ? formatSize(currentSize) : units || String(warningCount);
  return {
    files: fileCount,
    groupLabel,
    groupCount,
    itemLabel,
    itemCount,
    sizeLabel,
    sizeValue,
    warningCount
  };
}

export interface CadViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CadGeomPoint {
  x: number;
  y: number;
}

export interface CadGeomEntity {
  id: string;
  type: string;
  layer: string;
  colorHex: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  text: string;
  points: CadGeomPoint[];
}

export function formatCadFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getCadFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

const CAD_MODEL_NAME_ALIASES: Record<string, string> = {
  'shop-floor': 'ShopFloor',
  shopfloor: 'ShopFloor',
  'warehouse-l1': 'Warehouse L1',
  'motor-mount': 'Pump Skid',
  'pump-skid': 'Pump Skid',
  'led-driver': 'LED Driver',
  'clinic-l1': 'Clinic L1',
  'clinic-mep': 'Clinic MEP',
  'clinic-structure': 'Clinic Structure',
  'clinic-structural': 'Clinic Structure',
  'clinic-clash': 'Clinic L1',
  'inv-x1': 'INV_X1',
  'bracket-plate': 'Bracket Plate',
  'office-l2': 'Office L2',
  'permit-set': 'Permit Set',
  'site-corridor': 'Site Corridor',
  'title-block': 'Title Block',
  'outline-plot': 'Outline Plot',
  'hinge-leaf': 'Hinge Leaf',
  'impeller-hub': 'Impeller Hub',
  'gearbox-housing': 'Gearbox Housing',
  'valve-body': 'Valve Body',
  'wing-rib': 'Wing Rib',
  'shaft-collar': 'Shaft Collar',
  'crank-arm': 'Crank Arm',
  'enclosure-lid': 'Enclosure Lid',
  'faucet-body': 'Faucet Body',
  'cabin-massing': 'Cabin Massing',
  'nucleo-hat': 'Nucleo Hat',
  'arduino-shield': 'Arduino Shield',
  'power-module': 'Power Module',
  'sensor-board': 'Sensor Board',
  'rf-shield': 'RF Shield',
  'nand2-x1': 'NAND2_X1',
  'library-annex': 'Library Annex',
  'classroom-wing': 'Classroom Wing',
  'campus-fed': 'Campus Fed',
  'duct-beam-clash': 'Duct-Beam Clash',
  'hotel-l3': 'Hotel L3',
  'hospital-hvac': 'Hospital HVAC',
  'parking-frame': 'Parking Frame'
};

export function prettyCadModelName(fileName: string, fallback = 'Model'): string {
  const strip = (value: string) =>
    value.replace(/\.(?:kicad_pcb|kicad_sch|kicad_pro|ifcxml|gdsii|[^.]+)$/i, '').replace(/^sample-/, '');
  const fromFile = strip(fileName);
  const key = (fromFile || fallback).toLowerCase().replace(/_/g, '-');
  if (CAD_MODEL_NAME_ALIASES[key]) return CAD_MODEL_NAME_ALIASES[key];
  const fallbackKey = strip(fallback).toLowerCase().replace(/_/g, '-');
  if (CAD_MODEL_NAME_ALIASES[fallbackKey]) return CAD_MODEL_NAME_ALIASES[fallbackKey];
  return fromFile || fallback;
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

export function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export function isMostlyText(bytes: Uint8Array): boolean {
  if (!bytes.length) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  let printable = 0;
  for (const b of sample) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)) printable += 1;
  }
  return printable / sample.length > 0.85;
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(new Uint8Array(reader.result));
      else reject(new Error('Failed to read file as ArrayBuffer'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadBinaryFile(bytes: Uint8Array, fileName: string, mime: string): void {
  if (typeof document === 'undefined') throw new Error('Download is only available in the browser');
  if (!bytes?.length) throw new Error('Nothing to download');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.trim() || 'download.bin';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(content: string, fileName: string, mime: string): void {
  if (typeof document === 'undefined') throw new Error('Download is only available in the browser');
  if (!content) throw new Error('Nothing to download');
  const blob = new Blob([content], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.trim() || 'download.txt';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  if (typeof document === 'undefined') throw new Error('Download is only available in the browser');
  if (!dataUrl) throw new Error('Nothing to download');
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName.trim() || 'snapshot.png';
  anchor.click();
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function aciToHex(aci: number): string {
  const n = Math.max(0, Math.floor(aci));
  if (n === 1) return '#ef4444';
  if (n === 2) return '#eab308';
  if (n === 3) return '#22c55e';
  if (n === 4) return '#22d3ee';
  if (n === 5) return '#3b82f6';
  if (n === 6) return '#d946ef';
  if (n === 7) return '#e2e8f0';
  if (n === 8) return '#94a3b8';
  if (n === 9) return '#f97316';
  const palette = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#fb7185'];
  return palette[n % palette.length];
}

export function entityBBox(entities: CadGeomEntity[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const touch = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    const t = e.type.toLowerCase();
    if (t === 'circle' || t === 'arc') {
      touch(e.x - e.r, e.y - e.r);
      touch(e.x + e.r, e.y + e.r);
    } else if (t === 'line') {
      touch(e.x, e.y);
      touch(e.x2, e.y2);
    } else if ((t === 'lwpolyline' || t === 'polyline') && e.points.length) {
      for (const p of e.points) touch(p.x, p.y);
    } else {
      touch(e.x, e.y);
      if (e.x2 || e.y2) touch(e.x2, e.y2);
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  if (minX === maxX) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }
  return { minX, minY, maxX, maxY };
}

export function fitCadView(entities: CadGeomEntity[], width: number, height: number, pad = 36): CadViewTransform {
  const box = entityBBox(entities);
  const spanX = Math.max(1e-6, box.maxX - box.minX);
  const spanY = Math.max(1e-6, box.maxY - box.minY);
  const scale = Math.min((Math.max(64, width) - pad * 2) / spanX, (Math.max(64, height) - pad * 2) / spanY);
  return {
    scale,
    offsetX: pad - box.minX * scale,
    offsetY: pad - box.minY * scale
  };
}

export function worldToScreen(x: number, y: number, view: CadViewTransform, canvasHeight: number): CadGeomPoint {
  return {
    x: x * view.scale + view.offsetX,
    y: canvasHeight - (y * view.scale + view.offsetY)
  };
}

export function sizeCadCanvas(canvas: HTMLCanvasElement, minHeight = 280): { width: number; height: number } {
  const parent = canvas.parentElement;
  const width = Math.max(320, Math.floor(parent?.clientWidth || canvas.width || 640));
  const height = Math.max(minHeight, Math.floor(parent?.clientHeight || canvas.height || minHeight));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Hit-test drawable entities in screen space. Returns the nearest id within `maxPx`, or null. */
export function pickCadEntityAtScreen(
  entities: CadGeomEntity[],
  view: CadViewTransform,
  canvasHeight: number,
  sx: number,
  sy: number,
  maxPx = 14
): string | null {
  let bestId: string | null = null;
  let best = maxPx;
  for (const e of entities) {
    const t = e.type.toLowerCase();
    let d = Number.POSITIVE_INFINITY;
    if (t === 'line') {
      const a = worldToScreen(e.x, e.y, view, canvasHeight);
      const b = worldToScreen(e.x2, e.y2, view, canvasHeight);
      d = distToSegment(sx, sy, a.x, a.y, b.x, b.y);
    } else if (t === 'circle' || t === 'arc') {
      const c = worldToScreen(e.x, e.y, view, canvasHeight);
      d = Math.abs(Math.hypot(c.x - sx, c.y - sy) - Math.max(2, e.r * view.scale));
    } else if ((t === 'lwpolyline' || t === 'polyline') && e.points.length) {
      const pts = e.points.map((p) => worldToScreen(p.x, p.y, view, canvasHeight));
      for (let i = 1; i < pts.length; i++) {
        d = Math.min(d, distToSegment(sx, sy, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
      }
      if (pts.length === 1) d = Math.hypot(pts[0].x - sx, pts[0].y - sy);
    } else {
      const p = worldToScreen(e.x, e.y, view, canvasHeight);
      d = Math.hypot(p.x - sx, p.y - sy);
    }
    if (d < best) {
      best = d;
      bestId = e.id;
    }
  }
  return bestId;
}

export function renderCadDrawing(
  canvas: HTMLCanvasElement,
  entities: CadGeomEntity[],
  selectedId: string | null,
  view: CadViewTransform,
  selectedFill = 'rgba(194, 65, 12, 0.35)',
  theme?: Partial<CadCanvasTheme> | 'light' | 'dark'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const colors = paintCadCanvasBackground(ctx, canvas, theme);
  if (!entities.length) {
    ctx.fillStyle = colors.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No drawable entities in this CAD file.', 16, 28);
    return;
  }
  const to = (x: number, y: number) => worldToScreen(x, y, view, canvas.height);
  for (const e of entities) {
    const selected = e.id === selectedId;
    ctx.strokeStyle = e.colorHex || colors.muted;
    ctx.fillStyle = e.colorHex || colors.muted;
    ctx.lineWidth = selected ? 2.6 : 1.4;
    const t = e.type.toLowerCase();
    if (t === 'line') {
      const a = to(e.x, e.y);
      const b = to(e.x2, e.y2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (t === 'circle') {
      const c = to(e.x, e.y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2, e.r * view.scale), 0, Math.PI * 2);
      ctx.stroke();
    } else if (t === 'arc') {
      const c = to(e.x, e.y);
      const start = (e.x2 * Math.PI) / 180;
      const end = (e.y2 * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2, e.r * view.scale), -end, -start, true);
      ctx.stroke();
    } else if ((t === 'lwpolyline' || t === 'polyline') && e.points.length) {
      ctx.beginPath();
      e.points.forEach((p, i) => {
        const s = to(p.x, p.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.stroke();
      if (selected) {
        ctx.fillStyle = selectedFill;
        ctx.fill();
      }
    } else if (t === 'text') {
      const p = to(e.x, e.y);
      ctx.font = `${Math.max(11, 12 * view.scale)}px sans-serif`;
      ctx.fillStyle = e.colorHex || colors.text;
      ctx.fillText(e.text || e.id || '', p.x, p.y);
    } else if (t === 'point') {
      const p = to(e.x, e.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, selected ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const p = to(e.x, e.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (selected && t !== 'lwpolyline' && t !== 'polyline') {
      const p = to(e.x, e.y);
      ctx.strokeStyle = colors.selection;
      ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
    }
  }
  ctx.fillStyle = colors.hint;
  ctx.font = '11px sans-serif';
  ctx.fillText('Drag to pan · click to select · wheel zoom · Fit', 12, canvas.height - 12);
}
