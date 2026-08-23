import type { GeoModelLayer, ParsedGeoModel } from '../types/geological-model-viewer.types';

function layerDepth(layer: GeoModelLayer, x: number, xmin: number, xmax: number, which: 'top' | 'base'): number {
  const span = xmax - xmin || 1;
  const t = (x - xmin) / span;
  const fold = layer.foldAmplitude * Math.sin(t * Math.PI * 1.6);
  return (which === 'top' ? layer.top : layer.base) + fold;
}

export function renderGeoModelMap(
  canvas: HTMLCanvasElement,
  parsed: ParsedGeoModel,
  options: { selectedLayerId: string | null; visibleIds: Set<string>; selectedWellId: string | null; background?: string }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const pad = 36;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  const { xmin, xmax, ymin, ymax } = parsed.extent;
  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin || 1)) * w;
  const sy = (y: number) => pad + h - ((y - ymin) / (ymax - ymin || 1)) * h;

  ctx.strokeStyle = '#334155';
  ctx.strokeRect(pad, pad, w, h);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${xmin.toFixed(0)}`, pad, canvas.height - 10);
  ctx.fillText(`${xmax.toFixed(0)}`, pad + w - 28, canvas.height - 10);
  ctx.fillText(`${ymax.toFixed(0)}`, 6, pad + 8);
  ctx.fillText(`${ymin.toFixed(0)}`, 6, pad + h);

  parsed.layers.forEach((layer, i) => {
    if (!options.visibleIds.has(layer.id)) return;
    ctx.globalAlpha = options.selectedLayerId && options.selectedLayerId !== layer.id ? 0.35 : 0.55;
    ctx.fillStyle = layer.color;
    ctx.strokeStyle = options.selectedLayerId === layer.id ? '#f8fafc' : layer.color;
    if (layer.polygon.length >= 3) {
      ctx.beginPath();
      layer.polygon.forEach((p, pi) => (pi === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    } else {
      const inset = 8 + i * 10;
      ctx.fillRect(pad + inset, pad + inset, w - inset * 2, h - inset * 2);
      ctx.globalAlpha = 1;
      ctx.strokeRect(pad + inset, pad + inset, w - inset * 2, h - inset * 2);
    }
  });
  ctx.globalAlpha = 1;

  parsed.wells.forEach((well) => {
    const x = sx(well.x);
    const y = sy(well.y);
    ctx.fillStyle = options.selectedWellId === well.id ? '#f8fafc' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(x, y, options.selectedWellId === well.id ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(well.name, x + 8, y - 6);
  });
}

export function renderGeoModelSection(
  canvas: HTMLCanvasElement,
  parsed: ParsedGeoModel,
  options: {
    visibleIds: Set<string>;
    selectedLayerId: string | null;
    selectedWellId: string | null;
    exaggeration: number;
    background?: string;
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = options.background ?? '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const padL = 52;
  const padT = 24;
  const padB = 32;
  const padR = 16;
  const w = canvas.width - padL - padR;
  const h = canvas.height - padT - padB;
  const { xmin, xmax, zmin, zmax } = parsed.extent;
  const ex = Math.max(0.25, options.exaggeration);
  const zSpan = (zmax - zmin || 1) / ex;
  const sx = (x: number) => padL + ((x - xmin) / (xmax - xmin || 1)) * w;
  const sz = (z: number) => padT + ((z - zmin) / zSpan) * h;

  ctx.strokeStyle = '#334155';
  ctx.strokeRect(padL, padT, w, Math.min(h, canvas.height - padT - padB));
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${xmin.toFixed(0)}`, padL, canvas.height - 10);
  ctx.fillText(`${xmax.toFixed(0)}`, padL + w - 36, canvas.height - 10);
  ctx.fillText(`${zmin.toFixed(0)}`, 8, padT + 8);
  ctx.fillText(`${zmax.toFixed(0)}`, 8, Math.min(padT + h, canvas.height - padB));

  const steps = 80;
  parsed.layers.forEach((layer) => {
    if (!options.visibleIds.has(layer.id)) return;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = xmin + ((xmax - xmin) * i) / steps;
      const z = layerDepth(layer, x, xmin, xmax, 'top');
      const px = sx(x);
      const py = sz(z);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) {
      const x = xmin + ((xmax - xmin) * i) / steps;
      ctx.lineTo(sx(x), sz(layerDepth(layer, x, xmin, xmax, 'base')));
    }
    ctx.closePath();
    ctx.fillStyle = layer.color;
    ctx.globalAlpha = options.selectedLayerId && options.selectedLayerId !== layer.id ? 0.4 : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = options.selectedLayerId === layer.id ? '#f8fafc' : 'rgba(15,23,42,0.35)';
    ctx.stroke();
  });

  parsed.faults.forEach((fault) => {
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(sx(fault.x1), sz(fault.z1));
    ctx.lineTo(sx(fault.x2), sz(fault.z2));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.fillStyle = '#fda4af';
    ctx.fillText(fault.name, sx((fault.x1 + fault.x2) / 2) + 4, sz((fault.z1 + fault.z2) / 2) - 4);
  });

  parsed.wells.forEach((well) => {
    const x = sx(well.x);
    ctx.strokeStyle = options.selectedWellId === well.id ? '#f8fafc' : '#38bdf8';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, sz(zmin));
    ctx.lineTo(x, sz(Math.min(well.td || zmax, zmax)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(well.name, x + 6, padT + 12);
  });
}
