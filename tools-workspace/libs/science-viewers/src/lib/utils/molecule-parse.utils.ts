import type {
  MoleculeAtom,
  MoleculeBond,
  MoleculeChain,
  MoleculeResidue,
  MoleculeSecondarySpan,
  ParsedMolecule
} from '../types/molecule.types';

const COVALENT_RADII: Record<string, number> = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  P: 1.07,
  S: 1.05,
  CL: 1.02,
  BR: 1.2,
  I: 1.39,
  FE: 1.32,
  ZN: 1.22,
  MG: 1.41,
  CA: 1.76,
  NA: 1.66,
  K: 2.03
};

const AA1: Record<string, string> = {
  ALA: 'A',
  ARG: 'R',
  ASN: 'N',
  ASP: 'D',
  CYS: 'C',
  GLN: 'Q',
  GLU: 'E',
  GLY: 'G',
  HIS: 'H',
  ILE: 'I',
  LEU: 'L',
  LYS: 'K',
  MET: 'M',
  PHE: 'F',
  PRO: 'P',
  SER: 'S',
  THR: 'T',
  TRP: 'W',
  TYR: 'Y',
  VAL: 'V'
};

function normalizeElement(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return 'C';
  if (trimmed.length === 1) return trimmed;
  if (trimmed === 'CL' || trimmed === 'BR' || trimmed === 'FE' || trimmed === 'ZN' || trimmed === 'MG' || trimmed === 'NA' || trimmed === 'CA') {
    return trimmed;
  }
  return trimmed[0];
}

function covalentRadius(el: string): number {
  return COVALENT_RADII[el] ?? 0.8;
}

function maybeBond(a: MoleculeAtom, b: MoleculeAtom, bonds: MoleculeBond[]): void {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const max = covalentRadius(a.element) + covalentRadius(b.element) + 0.45;
  if (dist > 0.4 && dist <= max) {
    bonds.push({ from: Math.min(a.index, b.index), to: Math.max(a.index, b.index), order: 1 });
  }
}

function inferBonds(atoms: MoleculeAtom[]): MoleculeBond[] {
  const bonds: MoleculeBond[] = [];
  if (atoms.length <= 2500) {
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        maybeBond(atoms[i], atoms[j], bonds);
      }
    }
    return bonds;
  }
  const byResidue = new Map<string, MoleculeAtom[]>();
  for (const atom of atoms) {
    const key = `${atom.chainId}:${atom.residueSeq}`;
    const list = byResidue.get(key) ?? [];
    list.push(atom);
    byResidue.set(key, list);
  }
  byResidue.forEach((group) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) maybeBond(group[i], group[j], bonds);
    }
  });
  const sorted = [...atoms].sort((a, b) => a.chainId.localeCompare(b.chainId) || a.residueSeq - b.residueSeq);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].name.trim() !== 'C') continue;
    for (let j = i + 1; j < Math.min(sorted.length, i + 12); j++) {
      if (sorted[j].chainId !== sorted[i].chainId) break;
      if (sorted[j].residueSeq > sorted[i].residueSeq + 1) break;
      if (sorted[j].name.trim() === 'N') maybeBond(sorted[i], sorted[j], bonds);
    }
  }
  return bonds;
}

function buildResidues(atoms: MoleculeAtom[], secondary: MoleculeSecondarySpan[]): MoleculeResidue[] {
  const map = new Map<string, MoleculeResidue>();
  for (const atom of atoms) {
    const id = `${atom.chainId}:${atom.residueSeq}:${atom.residueName}`;
    let residue = map.get(id);
    if (!residue) {
      residue = {
        id,
        chainId: atom.chainId,
        resSeq: atom.residueSeq,
        resName: atom.residueName,
        atomIndices: [],
        caIndex: null,
        secondary: 'coil'
      };
      map.set(id, residue);
    }
    residue.atomIndices.push(atom.index);
    if (atom.name.trim() === 'CA') residue.caIndex = atom.index;
  }
  for (const residue of map.values()) {
    const hit = secondary.find(
      (s) => s.chainId === residue.chainId && residue.resSeq >= s.startRes && residue.resSeq <= s.endRes
    );
    if (hit) residue.secondary = hit.kind;
  }
  return [...map.values()].sort((a, b) => a.chainId.localeCompare(b.chainId) || a.resSeq - b.resSeq);
}

function buildChains(residues: MoleculeResidue[], atoms: MoleculeAtom[]): MoleculeChain[] {
  const map = new Map<string, MoleculeChain>();
  for (const residue of residues) {
    let chain = map.get(residue.chainId);
    if (!chain) {
      chain = { id: residue.chainId, residueCount: 0, atomCount: 0, sequence: '' };
      map.set(residue.chainId, chain);
    }
    chain.residueCount += 1;
    chain.sequence += AA1[residue.resName] ?? 'X';
  }
  for (const atom of atoms) {
    const chain = map.get(atom.chainId);
    if (chain) chain.atomCount += 1;
  }
  return [...map.values()];
}

function computeBounds(atoms: MoleculeAtom[]): { center: { x: number; y: number; z: number }; radius: number } {
  if (!atoms.length) return { center: { x: 0, y: 0, z: 0 }, radius: 1 };
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const a of atoms) {
    sx += a.x;
    sy += a.y;
    sz += a.z;
  }
  const center = { x: sx / atoms.length, y: sy / atoms.length, z: sz / atoms.length };
  let max = 1;
  for (const a of atoms) {
    const dx = a.x - center.x;
    const dy = a.y - center.y;
    const dz = a.z - center.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > max) max = d;
  }
  return { center, radius: max };
}

function elementCounts(atoms: MoleculeAtom[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of atoms) {
    counts[a.element] = (counts[a.element] ?? 0) + 1;
  }
  return counts;
}

function parsePdb(text: string, warnings: string[]): ParsedMolecule {
  const atoms: MoleculeAtom[] = [];
  const conect: MoleculeBond[] = [];
  const secondary: MoleculeSecondarySpan[] = [];
  let title = '';
  let header = '';
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const rec = line.slice(0, 6).trim();
    if (rec === 'HEADER') header = line.slice(10).trim();
    else if (rec === 'TITLE') title = `${title} ${line.slice(10).trim()}`.trim();
    else if (rec === 'ATOM' || rec === 'HETATM') {
      const serial = Number(line.slice(6, 11).trim()) || atoms.length + 1;
      const name = line.slice(12, 16).trim() || 'X';
      const resName = line.slice(17, 20).trim() || 'UNK';
      const chainId = (line.slice(21, 22).trim() || 'A');
      const resSeq = Number(line.slice(22, 26).trim()) || 1;
      const x = Number(line.slice(30, 38).trim());
      const y = Number(line.slice(38, 46).trim());
      const z = Number(line.slice(46, 54).trim());
      if (![x, y, z].every(Number.isFinite)) {
        warnings.push(`Skipped atom serial ${serial} with invalid coordinates.`);
        continue;
      }
      const occ = Number(line.slice(54, 60).trim());
      const bfac = Number(line.slice(60, 66).trim());
      let element = line.length >= 78 ? line.slice(76, 78).trim() : '';
      if (!element) element = name.replace(/[0-9]/g, '').slice(0, 2);
      atoms.push({
        index: atoms.length,
        serial,
        name,
        element: normalizeElement(element),
        x,
        y,
        z,
        residueName: resName,
        residueSeq: resSeq,
        chainId,
        hetero: rec === 'HETATM',
        occupancy: Number.isFinite(occ) ? occ : undefined,
        tempFactor: Number.isFinite(bfac) ? bfac : undefined
      });
    } else if (rec === 'CONECT') {
      const fromSerial = Number(line.slice(6, 11).trim());
      const targets = [11, 16, 21, 26]
        .map((start) => Number(line.slice(start, start + 5).trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const from = atoms.find((a) => a.serial === fromSerial);
      if (!from) continue;
      for (const serial of targets) {
        const to = atoms.find((a) => a.serial === serial);
        if (!to || to.index <= from.index) continue;
        conect.push({ from: from.index, to: to.index, order: 1 });
      }
    } else if (rec === 'HELIX') {
      const chainId = line.slice(19, 20).trim() || 'A';
      const startRes = Number(line.slice(21, 25).trim());
      const endRes = Number(line.slice(33, 37).trim());
      if (Number.isFinite(startRes) && Number.isFinite(endRes)) {
        secondary.push({ kind: 'helix', chainId, startRes, endRes, label: line.slice(11, 14).trim() || 'H' });
      }
    } else if (rec === 'SHEET') {
      const chainId = line.slice(21, 22).trim() || 'A';
      const startRes = Number(line.slice(22, 26).trim());
      const endRes = Number(line.slice(33, 37).trim());
      if (Number.isFinite(startRes) && Number.isFinite(endRes)) {
        secondary.push({ kind: 'sheet', chainId, startRes, endRes, label: line.slice(11, 14).trim() || 'S' });
      }
    }
  }
  if (!atoms.length) throw new Error('No ATOM/HETATM records found in PDB.');
  const bonds = conect.length ? conect : inferBonds(atoms);
  if (!conect.length) warnings.push('No CONECT records — bonds inferred from covalent radii.');
  if (atoms.length > 8000) {
    warnings.push(`Large structure (${atoms.length} atoms) — preview may be slower; consider a subset PDB.`);
  }
  const residues = buildResidues(atoms, secondary);
  const chains = buildChains(residues, atoms);
  const bounds = computeBounds(atoms);
  return {
    format: 'pdb',
    title: title || header || 'PDB structure',
    header,
    atoms,
    bonds,
    residues,
    chains,
    secondary,
    elementCounts: elementCounts(atoms),
    ...bounds,
    warnings
  };
}

function parseMolBlock(text: string, warnings: string[]): ParsedMolecule {
  if (/V3000/i.test(text) && !/V2000/i.test(text)) {
    warnings.push('MOL V3000 is not fully supported — V2000 atom/bond tables are required.');
  }
  const molCount = (text.match(/\$\$\$\$/g) ?? []).length;
  if (molCount > 1) {
    warnings.push(`SDF contains ${molCount} molecules — only the first block is previewed.`);
  }
  const lines = text.split(/\r?\n/);
  const title = (lines[0] ?? '').trim() || 'MOL structure';
  const counts = lines[3] ?? '';
  const atomCount = Number(counts.slice(0, 3).trim());
  const bondCount = Number(counts.slice(3, 6).trim());
  if (!Number.isFinite(atomCount) || atomCount <= 0) {
    throw new Error('Invalid MOL/SDF counts line — expected V2000 atom/bond counts.');
  }
  const atoms: MoleculeAtom[] = [];
  for (let i = 0; i < atomCount; i++) {
    const line = lines[4 + i] ?? '';
    const x = Number(line.slice(0, 10).trim());
    const y = Number(line.slice(10, 20).trim());
    const z = Number(line.slice(20, 30).trim());
    const el = normalizeElement(line.slice(31, 34));
    if (![x, y, z].every(Number.isFinite)) {
      warnings.push(`Skipped MOL atom ${i + 1} with invalid coordinates.`);
      continue;
    }
    atoms.push({
      index: atoms.length,
      serial: i + 1,
      name: el,
      element: el,
      x,
      y,
      z,
      residueName: 'MOL',
      residueSeq: 1,
      chainId: 'A',
      hetero: true
    });
  }
  const bonds: MoleculeBond[] = [];
  for (let i = 0; i < bondCount; i++) {
    const line = lines[4 + atomCount + i] ?? '';
    const from = Number(line.slice(0, 3).trim()) - 1;
    const to = Number(line.slice(3, 6).trim()) - 1;
    const order = Number(line.slice(6, 9).trim()) || 1;
    if (from >= 0 && to >= 0 && from < atoms.length && to < atoms.length) {
      bonds.push({ from: Math.min(from, to), to: Math.max(from, to), order });
    }
  }
  if (!atoms.length) throw new Error('No atoms found in MOL/SDF block.');
  const residues = buildResidues(atoms, []);
  const chains = buildChains(residues, atoms);
  const bounds = computeBounds(atoms);
  return {
    format: text.includes('$$$$') ? 'sdf' : 'mol',
    title,
    header: (lines[1] ?? '').trim(),
    atoms,
    bonds,
    residues,
    chains,
    secondary: [],
    elementCounts: elementCounts(atoms),
    ...bounds,
    warnings
  };
}

export function parseMoleculeText(text: string, fileName = 'structure'): ParsedMolecule {
  const warnings: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) throw new Error('File is empty');
  const lower = fileName.toLowerCase();
  const looksPdb =
    lower.endsWith('.pdb') ||
    lower.endsWith('.ent') ||
    /^HEADER\b|^ATOM\s|^HETATM\s|^TITLE\b/m.test(trimmed);
  const looksMol = lower.endsWith('.mol') || lower.endsWith('.sdf') || /V2000|V3000/.test(trimmed);
  if (looksPdb && !looksMol) return parsePdb(trimmed, warnings);
  if (looksMol) return parseMolBlock(trimmed, warnings);
  if (/^ATOM\s|^HETATM\s/m.test(trimmed)) return parsePdb(trimmed, warnings);
  if (/V2000|V3000/.test(trimmed)) return parseMolBlock(trimmed, warnings);
  throw new Error('Unrecognized molecular format — use PDB, MOL, or SDF.');
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
