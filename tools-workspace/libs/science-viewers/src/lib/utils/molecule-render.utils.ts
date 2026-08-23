import type { MoleculeRenderOptions, ParsedMolecule } from '../types/molecule.types';

export const CPK_COLORS: Record<string, string> = {
  H: '#f8fafc',
  C: '#94a3b8',
  N: '#60a5fa',
  O: '#f87171',
  S: '#facc15',
  P: '#fb923c',
  F: '#4ade80',
  CL: '#22c55e',
  BR: '#b45309',
  I: '#a855f7',
  FE: '#fb7185',
  ZN: '#818cf8',
  MG: '#34d399',
  CA: '#fbbf24',
  NA: '#38bdf8',
  K: '#c084fc'
};

export const SS_COLORS = {
  helix: '#c084fc',
  sheet: '#facc15',
  coil: '#94a3b8'
};

function elementColor(el: string): string {
  return CPK_COLORS[el] ?? '#cbd5e1';
}

function rotatePoint(x: number, y: number, z: number, rotX: number, rotY: number): { x: number; y: number; z: number } {
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}

export function hitTestAtom(
  molecule: ParsedMolecule,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  options: MoleculeRenderOptions
): number | null {
  const rect = canvas.getBoundingClientRect();
  const mx = ((clientX - rect.left) / rect.width) * canvas.width;
  const my = ((clientY - rect.top) / rect.height) * canvas.height;
  const { center, radius } = molecule;
  const scale = Math.min(canvas.width, canvas.height) * 0.38 * options.zoom / Math.max(radius, 1);
  const ox = canvas.width / 2;
  const oy = canvas.height / 2;
  let best: { index: number; z: number; d: number } | null = null;
  for (const atom of molecule.atoms) {
    if (!options.showHydrogens && atom.element === 'H') continue;
    if (options.showHetero === false && atom.hetero) continue;
    if (options.chainFilter && atom.chainId !== options.chainFilter) continue;
    const p = rotatePoint(atom.x - center.x, atom.y - center.y, atom.z - center.z, options.rotX, options.rotY);
    const sx = ox + p.x * scale;
    const sy = oy - p.y * scale;
    const r = options.style === 'spacefill' ? 10 * options.zoom : 5 * options.zoom;
    const dx = mx - sx;
    const dy = my - sy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= r + 4 && (!best || p.z > best.z)) {
      best = { index: atom.index, z: p.z, d };
    }
  }
  return best?.index ?? null;
}

export function renderMolecule(
  canvas: HTMLCanvasElement,
  molecule: ParsedMolecule,
  options: MoleculeRenderOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const bg = options.background ?? '#0f172a';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { center, radius } = molecule;
  const scale = Math.min(canvas.width, canvas.height) * 0.38 * options.zoom / Math.max(radius, 1);
  const ox = canvas.width / 2;
  const oy = canvas.height / 2;
  const chain = options.chainFilter;

  const projectedAtoms = molecule.atoms
    .filter(
      (a) =>
        (options.showHydrogens || a.element !== 'H') &&
        (options.showHetero !== false || !a.hetero) &&
        (!chain || a.chainId === chain)
    )
    .map((atom) => {
      const p = rotatePoint(atom.x - center.x, atom.y - center.y, atom.z - center.z, options.rotX, options.rotY);
      const residue = molecule.residues.find((r) => r.atomIndices.includes(atom.index));
      return {
        atom,
        ...p,
        sx: ox + p.x * scale,
        sy: oy - p.y * scale,
        residue
      };
    });

  if (options.style === 'ribbon' || options.style === 'backbone') {
    const residues = molecule.residues
      .filter((r) => r.caIndex != null && (!chain || r.chainId === chain))
      .sort((a, b) => a.chainId.localeCompare(b.chainId) || a.resSeq - b.resSeq);
    const byChain = new Map<string, typeof residues>();
    for (const residue of residues) {
      const list = byChain.get(residue.chainId) ?? [];
      list.push(residue);
      byChain.set(residue.chainId, list);
    }
    byChain.forEach((list) => {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 1; i < list.length; i++) {
        const prev = projectedAtoms.find((p) => p.atom.index === list[i - 1].caIndex);
        const curr = projectedAtoms.find((p) => p.atom.index === list[i].caIndex);
        if (!prev || !curr) continue;
        ctx.beginPath();
        ctx.moveTo(prev.sx, prev.sy);
        ctx.lineTo(curr.sx, curr.sy);
        ctx.strokeStyle = SS_COLORS[list[i].secondary];
        ctx.lineWidth = options.style === 'ribbon' ? (list[i].secondary === 'coil' ? 4 : 8) * options.zoom : 3 * options.zoom;
        ctx.stroke();
      }
    });
    return;
  }

  for (const bond of molecule.bonds) {
    const a = projectedAtoms.find((p) => p.atom.index === bond.from);
    const b = projectedAtoms.find((p) => p.atom.index === bond.to);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = (options.style === 'wireframe' ? 1.2 : 2.2) * Math.max(bond.order, 1) * options.zoom;
    ctx.stroke();
  }

  if (options.style === 'wireframe') return;

  const sorted = [...projectedAtoms].sort((a, b) => a.z - b.z);
  for (const p of sorted) {
    const highlighted =
      options.highlightAtom === p.atom.index ||
      (options.highlightResidue != null && p.residue?.id === options.highlightResidue);
    const r =
      (options.style === 'spacefill' ? 11 : 4.6) *
      options.zoom *
      (p.atom.element === 'H' ? 0.6 : 1) *
      (highlighted ? 1.25 : 1);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = elementColor(p.atom.element);
    ctx.fill();
    if (highlighted) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
