import type { DecisionModelDecision, DecisionModelDependency, DecisionModelStat } from '../types/decision-model-viewer.types';

const KIND_COLORS: Record<string, string> = {
  table: '#f97316',
  expression: '#38bdf8',
  invocation: '#a78bfa',
  boxed: '#94a3b8'
};

const DEP_COLORS: Record<string, string> = {
  information: '#0ea5e9',
  authority: '#f59e0b',
  knowledge: '#22c55e'
};

export function decisionModelKindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#fb923c';
}

export function decisionModelDepColor(type: string): string {
  return DEP_COLORS[type] ?? '#94a3b8';
}

export function renderDecisionModelKinds(canvas: HTMLCanvasElement, kinds: DecisionModelStat[], selected: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!kinds.length) return;
  const pad = 24;
  const max = Math.max(...kinds.map((k) => k.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / kinds.length));
  kinds.forEach((k, i) => {
    const y = pad + i * rowH;
    if (k.name === selected) {
      ctx.fillStyle = 'rgba(154, 52, 18, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${k.name} (${k.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 140) * k.count) / max;
    ctx.fillStyle = decisionModelKindColor(k.name);
    ctx.fillRect(pad + 130, y, Math.max(4, w), 12);
  });
}

export function renderDecisionModelDependencies(
  canvas: HTMLCanvasElement,
  deps: DecisionModelDependency[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!deps.length) return;
  const pad = 24;
  const rowH = Math.min(48, Math.max(30, (canvas.height - pad * 2) / deps.length));
  deps.forEach((d, i) => {
    const y = pad + i * rowH;
    if (d.id === selectedId) {
      ctx.fillStyle = 'rgba(154, 52, 18, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${d.sourceName} → ${d.targetName}`, pad, y + 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(d.type, pad, y + 26);
    ctx.fillStyle = decisionModelDepColor(d.type);
    ctx.fillRect(canvas.width - pad - 72, y + 6, 64, 10);
  });
}

export function renderDecisionModelDecisions(
  canvas: HTMLCanvasElement,
  decisions: DecisionModelDecision[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!decisions.length) return;
  const pad = 24;
  const max = Math.max(...decisions.map((d) => d.ruleCount || d.dependsOn.length || 1), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / decisions.length));
  decisions.forEach((d, i) => {
    const y = pad + i * rowH;
    if (d.id === selectedId) {
      ctx.fillStyle = 'rgba(154, 52, 18, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${d.name} (${d.ruleCount})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 200) * (d.ruleCount || 1)) / max;
    ctx.fillStyle = decisionModelKindColor(d.kind);
    ctx.fillRect(pad + 190, y, Math.max(4, w), 12);
  });
}
