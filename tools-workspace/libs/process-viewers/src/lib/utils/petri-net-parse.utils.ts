import type {
  PetriNetArc,
  PetriNetDataset,
  PetriNetPlace,
  PetriNetSourceKind,
  PetriNetTransition
} from '../types/petri-net-viewer.types';
import { parsePnmlText } from './pnml-parse.utils';

function rewritePnmlError(message: string): string {
  return message
    .replace('Not a PNML document', 'Not a Petri net / PNML document')
    .replace('No PNML net found', 'No Petri net found')
    .replace('PNML file is empty', 'Petri net file is empty')
    .replace('Invalid PNML JSON', 'Invalid Petri net JSON')
    .replace('PNML JSON must be an object', 'Petri net JSON must be an object')
    .replace('PNML JSON is missing places', 'Petri net JSON is missing places')
    .replace(/PNML CSV/g, 'Petri net CSV')
    .replace('PNML document contains', 'Petri net contains');
}

function fromPnml(name: string, sourceKind: PetriNetSourceKind, netType: string, places: PetriNetPlace[], transitions: PetriNetTransition[], arcs: PetriNetArc[], warnings: string[]): PetriNetDataset {
  if (!places.length) warnings.push('Petri net contains no places.');
  if (!transitions.length && places.length) warnings.push('Petri net has places but no transitions.');
  const tokenTotal = places.reduce((sum, p) => sum + p.initialTokens, 0);
  if (!tokenTotal) warnings.push('Initial marking is empty — no tokens on any place.');
  return { name, sourceKind, netType, places, transitions, arcs, warnings };
}

export function parsePetriNetText(text: string, fileName = ''): PetriNetDataset {
  try {
    const pnml = parsePnmlText(text, fileName);
    const places: PetriNetPlace[] = pnml.places.map((p) => ({
      id: p.id,
      index: p.index,
      name: p.name,
      initialTokens: p.tokens,
      x: p.x,
      y: p.y,
      inCount: p.inCount,
      outCount: p.outCount
    }));
    const transitions: PetriNetTransition[] = pnml.transitions.map((t) => ({
      id: t.id,
      index: t.index,
      name: t.name,
      x: t.x,
      y: t.y,
      inCount: t.inCount,
      outCount: t.outCount
    }));
    const arcs: PetriNetArc[] = pnml.arcs.map((a) => ({
      id: a.id,
      index: a.index,
      source: a.source,
      target: a.target,
      sourceName: a.sourceName,
      targetName: a.targetName,
      weight: a.weight
    }));
    const sourceKind: PetriNetSourceKind = pnml.sourceKind === 'pnml' ? 'pnml' : pnml.sourceKind;
    return fromPnml(pnml.name, sourceKind, pnml.netType, places, transitions, arcs, [...pnml.warnings]);
  } catch (error) {
    throw new Error(rewritePnmlError(error instanceof Error ? error.message : 'Invalid Petri net'));
  }
}

export function parsePetriNetBytes(bytes: Uint8Array, fileName = ''): PetriNetDataset {
  if (!bytes.length) throw new Error('Petri net file is empty');
  return parsePetriNetText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function initialPetriNetMarking(dataset: PetriNetDataset): Record<string, number> {
  const marking: Record<string, number> = {};
  for (const p of dataset.places) marking[p.id] = p.initialTokens;
  return marking;
}

export function tokenTotal(marking: Record<string, number>): number {
  return Object.values(marking).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
}

export function enabledPetriNetIds(dataset: PetriNetDataset, marking: Record<string, number>): string[] {
  return dataset.transitions
    .filter((t) => {
      const inputs = dataset.arcs.filter((a) => a.target === t.id);
      if (!inputs.length) return false;
      return inputs.every((a) => (marking[a.source] ?? 0) >= Math.max(1, a.weight || 1));
    })
    .map((t) => t.id);
}

export function firePetriNetTransition(
  dataset: PetriNetDataset,
  marking: Record<string, number>,
  transitionId: string
): { ok: boolean; marking: Record<string, number>; reason?: string } {
  const transition = dataset.transitions.find((t) => t.id === transitionId);
  if (!transition) return { ok: false, marking, reason: 'Unknown transition' };
  if (!enabledPetriNetIds(dataset, marking).includes(transitionId)) {
    return { ok: false, marking, reason: `${transition.name} is not enabled` };
  }
  const next = { ...marking };
  for (const a of dataset.arcs.filter((arc) => arc.target === transitionId)) {
    next[a.source] = (next[a.source] ?? 0) - Math.max(1, a.weight || 1);
  }
  for (const a of dataset.arcs.filter((arc) => arc.source === transitionId)) {
    next[a.target] = (next[a.target] ?? 0) + Math.max(1, a.weight || 1);
  }
  return { ok: true, marking: next };
}

export function formatPetriNetMarking(dataset: PetriNetDataset, marking: Record<string, number>): string {
  return dataset.places.map((p) => `${p.name}=${marking[p.id] ?? 0}`).join(';');
}

export function filterPetriNetPlaces(places: PetriNetPlace[], query: string, marking: Record<string, number>): PetriNetPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return places;
  const tokens = q.split(/\s+/).filter(Boolean);
  return places.filter((p) =>
    tokens.every((token) => {
      const current = marking[p.id] ?? p.initialTokens;
      if (token === 'marked' || token === 'tokens') return current > 0;
      if (token === 'empty') return current === 0;
      if (token.startsWith('place:')) return p.name.toLowerCase().includes(token.slice(6)) || p.id.toLowerCase().includes(token.slice(6));
      return `${p.id} ${p.name} ${current}`.toLowerCase().includes(token);
    })
  );
}

export function filterPetriNetTransitions(
  transitions: PetriNetTransition[],
  query: string,
  enabledIds: ReadonlyArray<string>
): PetriNetTransition[] {
  const q = query.trim().toLowerCase();
  if (!q) return transitions;
  const enabled = new Set(enabledIds);
  const tokens = q.split(/\s+/).filter(Boolean);
  return transitions.filter((t) =>
    tokens.every((token) => {
      if (token === 'enabled') return enabled.has(t.id);
      if (token === 'disabled') return !enabled.has(t.id);
      if (token.startsWith('transition:')) {
        return t.name.toLowerCase().includes(token.slice(11)) || t.id.toLowerCase().includes(token.slice(11));
      }
      return `${t.id} ${t.name} ${enabled.has(t.id) ? 'enabled' : 'disabled'}`.toLowerCase().includes(token);
    })
  );
}
