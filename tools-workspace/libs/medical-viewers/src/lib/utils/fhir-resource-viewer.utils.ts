import {
  FHIR_FORMATS_HINT,
  FHIR_MAX_FILE_BYTES,
  FHIR_SUPPORTED_EXTENSIONS
} from '../constants/fhir-resource-viewer.constants';
import type { FhirLoadedResource, FhirSuggestion, FhirTreeNode } from '../types/fhir-resource-viewer.types';
import { getFileExtension } from './medical-file.utils';
import {
  buildSampleFhirBundleJson,
  parseFhirBytes
} from './fhir-parse.utils';
import {
  createClinicalRecordId,
  filterValidClinicalFiles,
  isSupportedClinicalFile
} from './clinical-document.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  formatMedicalFileSize as formatFhirFileSize,
  readFileBytes as readFhirFileBytes
} from './medical-file.utils';

export { filterFhirReferences, filterFhirTimeline } from './fhir-parse.utils';

export function isSupportedFhirFile(file: File): boolean {
  return isSupportedClinicalFile(file, FHIR_SUPPORTED_EXTENSIONS);
}

export function filterValidFhirFiles(files: FileList | File[]) {
  return filterValidClinicalFiles(files, FHIR_SUPPORTED_EXTENSIONS, FHIR_MAX_FILE_BYTES);
}

export function createSampleFhirFile(): File {
  const json = buildSampleFhirBundleJson();
  return new File([json], 'sample-clinical-bundle.json', { type: 'application/json', lastModified: 0 });
}

export function createFhirResourceRecord(file: File, bytes: Uint8Array): FhirLoadedResource {
  const extension = getFileExtension(file.name) || '.json';
  const text = new TextDecoder('utf-8').decode(bytes);
  const format = extension === '.xml' || text.trim().startsWith('<') ? 'xml' : 'json';
  const parsed = parseFhirBytes(bytes, extension);
  const warnings = [...parsed.warnings];

  return {
    id: createClinicalRecordId(file),
    name: file.name,
    size: file.size,
    extension,
    bytes,
    text,
    format,
    parsed,
    warnings
  };
}

export function exportFhirSummaryJson(record: FhirLoadedResource): string {
  const p = record.parsed;
  return JSON.stringify(
    {
      name: record.name,
      format: record.format,
      primaryResourceType: p.primaryResourceType,
      primaryId: p.primaryId,
      resourceCount: p.resources.length,
      resources: p.resources.map((r) => ({ resourceType: r.resourceType, id: r.id })),
      referenceCount: p.references.length,
      timelineEventCount: p.timeline.length,
      warnings: record.warnings,
      note: 'Education/research FHIR preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function exportFhirReferencesJson(record: FhirLoadedResource): string {
  return JSON.stringify(
    {
      primaryResourceType: record.parsed.primaryResourceType,
      references: record.parsed.references
    },
    null,
    2
  );
}

export function exportFhirTimelineJson(record: FhirLoadedResource): string {
  return JSON.stringify(
    {
      primaryResourceType: record.parsed.primaryResourceType,
      timeline: record.parsed.timeline
    },
    null,
    2
  );
}

export function canExportFhir(record: FhirLoadedResource | null): boolean {
  return !!record && record.parsed.resources.length > 0;
}

export function resolveFhirSuggestion(state: {
  hasResources: boolean;
  hasError: boolean;
}): FhirSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample FHIR Bundle',
      reason: 'Load Patient + Observation resources to explore tree, references, and timeline.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/fhir-resource-viewer'
    };
  }
  if (!state.hasResources) {
    return {
      id: 'upload',
      title: 'Upload a FHIR resource',
      reason: FHIR_FORMATS_HINT,
      actionLabel: 'Choose file',
      path: '/medical-viewers/fhir-resource-viewer'
    };
  }
  return null;
}

export function nodeMatchesFhirQuery(node: FhirTreeNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (node.key.toLowerCase().includes(q)) return true;
  if (node.path.toLowerCase().includes(q)) return true;
  if (node.kind.toLowerCase().includes(q)) return true;
  if (node.value != null && String(node.value).toLowerCase().includes(q)) return true;
  return false;
}

/** Matching node ids plus ancestor ids so search can expand the path. */
export function findMatchingTreeNodeIds(nodes: FhirTreeNode[], query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const ids = new Set<string>();
  if (!q) return ids;

  const walk = (list: FhirTreeNode[], ancestors: string[]) => {
    for (const node of list) {
      if (nodeMatchesFhirQuery(node, q)) {
        ids.add(node.id);
        for (const ancestor of ancestors) ids.add(ancestor);
      }
      if (node.children?.length) walk(node.children, [...ancestors, node.id]);
    }
  };
  walk(nodes, []);
  return ids;
}

export function flattenVisibleTreeNodes(
  nodes: FhirTreeNode[],
  expandedIds: Set<string>,
  depth = 0
): Array<{ node: FhirTreeNode; depth: number }> {
  const out: Array<{ node: FhirTreeNode; depth: number }> = [];
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children?.length && expandedIds.has(node.id)) {
      out.push(...flattenVisibleTreeNodes(node.children, expandedIds, depth + 1));
    }
  }
  return out;
}

export function collectTreeNodeIds(nodes: FhirTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: FhirTreeNode[]) => {
    for (const n of list) {
      ids.push(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}

export function defaultExpandedTreeIds(nodes: FhirTreeNode[], maxDepth = 2): Set<string> {
  const expanded = new Set<string>();
  const walk = (list: FhirTreeNode[], depth: number) => {
    for (const n of list) {
      if (depth < maxDepth) expanded.add(n.id);
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return expanded;
}
