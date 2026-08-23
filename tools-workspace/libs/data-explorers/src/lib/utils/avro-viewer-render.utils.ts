import type { AvField, AvRecord } from '../types/avro-viewer.types';

export function avFieldColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'int' || t === 'long') return '#93c5fd';
  if (t === 'double' || t === 'float') return '#67e8f9';
  if (t === 'boolean') return '#fcd34d';
  if (t === 'string' || t === 'bytes') return '#c4b5fd';
  const colors = ['#60a5fa', '#3b82f6', '#2563eb', '#93c5fd', '#bfdbfe'];
  return colors[index % colors.length];
}

export function renderAvDiagram(
  canvas: HTMLCanvasElement,
  recordName: string,
  fields: AvField[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const origin = { x: 70, y: Math.max(40, canvas.height / 2) };
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(origin.x - 54, origin.y - 22, 108, 44);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText((recordName || 'record').slice(0, 12), origin.x - 40, origin.y + 4);
  if (!fields.length) return;
  const ys = fields.map((f) => f.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(1, maxY - minY);
  const mapY = (y: number) => 28 + ((y - minY) / spanY) * (canvas.height - 56);
  fields.forEach((f, i) => {
    const y = mapY(f.y);
    const x = canvas.width - 90;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(origin.x + 54, origin.y);
    ctx.lineTo(x - 50, y);
    ctx.stroke();
    ctx.fillStyle = f.id === selectedId ? '#dbeafe' : avFieldColor(f.type, i);
    ctx.fillRect(x - 50, y - 16, 100, 32);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(f.name.slice(0, 12), x - 40, y + 4);
  });
}

export function renderAvSchema(canvas: HTMLCanvasElement, fields: AvField[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!fields.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No fields in this Avro schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / fields.length));
  fields.forEach((f, i) => {
    const y = 16 + i * rowH;
    if (f.id === selectedId) {
      ctx.fillStyle = 'rgba(30, 58, 138, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = avFieldColor(f.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${f.name} · ${f.type}${f.nullable ? '?' : ''}`, 36, y + 11);
  });
}

export function renderAvSample(canvas: HTMLCanvasElement, records: AvRecord[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!records.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No sample records in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / records.length));
  records.forEach((r, i) => {
    const y = 16 + i * rowH;
    if (r.id === selectedId) {
      ctx.fillStyle = 'rgba(30, 58, 138, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(r.values).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
