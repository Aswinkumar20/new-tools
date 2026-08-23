import type {
  FhirReference,
  FhirResourceEntry,
  FhirTimelineEvent,
  FhirTreeNode,
  ParsedFhirDocument
} from '../types/fhir-resource-viewer.types';

const DATE_KEYS = new Set([
  'birthDate',
  'deceasedDateTime',
  'effectiveDateTime',
  'issued',
  'onsetDateTime',
  'recordedDate',
  'start',
  'end',
  'authoredOn',
  'date',
  'period',
  'meta'
]);

const REF_KEYS = new Set([
  'reference',
  'subject',
  'patient',
  'encounter',
  'performer',
  'requester',
  'basedOn',
  'partOf',
  'focus',
  'hasMember',
  'valueReference'
]);

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function nodeId(path: string): string {
  return path.replace(/[^a-zA-Z0-9_-]/g, '_') || 'root';
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T[\d:.+-Z]+)?$/.test(value);
}

function extractResourceTypeFromRef(ref: string): string | undefined {
  const match = /^([A-Za-z]+)\//.exec(ref);
  return match?.[1];
}

function buildTree(value: unknown, key: string, path: string): FhirTreeNode {
  const id = nodeId(path);

  if (value === null || value === undefined) {
    return { id, key, path, kind: 'primitive', value: null };
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return { id, key, path, kind: 'primitive', value };
  }

  if (typeof value === 'string') {
    const kind: FhirTreeNode['kind'] =
      key === 'reference' || (key.endsWith('Reference') && value.includes('/'))
        ? 'reference'
        : 'primitive';
    return { id, key, path, kind, value };
  }

  if (Array.isArray(value)) {
    return {
      id,
      key,
      path,
      kind: 'array',
      children: value.map((item, index) =>
        buildTree(item, String(index), `${path}[${index}]`)
      )
    };
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj['reference'] === 'string') {
      return {
        id,
        key,
        path,
        kind: 'reference',
        value: obj['reference'] as string,
        children: Object.entries(obj)
          .filter(([k]) => k !== 'reference')
          .map(([k, v]) => buildTree(v, k, `${path}.${k}`))
      };
    }
    return {
      id,
      key,
      path,
      kind: 'object',
      children: Object.entries(obj).map(([k, v]) => buildTree(v, k, `${path}.${k}`))
    };
  }

  return { id, key, path, kind: 'primitive', value: String(value) };
}

function walkReferences(value: unknown, path: string, out: FhirReference[]): void {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkReferences(item, `${path}[${index}]`, out));
    return;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj['reference'] === 'string') {
      const ref = obj['reference'];
      out.push({
        id: nodeId(`${path}-${ref}`),
        path,
        reference: ref,
        display: typeof obj['display'] === 'string' ? obj['display'] : undefined,
        resourceType: extractResourceTypeFromRef(ref)
      });
    }
    for (const [k, v] of Object.entries(obj)) {
      if (REF_KEYS.has(k) || k.endsWith('Reference') || typeof v === 'object') {
        walkReferences(v, path ? `${path}.${k}` : k, out);
      }
    }
  }
}

function walkTimeline(
  value: unknown,
  path: string,
  resourceType: string | undefined,
  out: FhirTimelineEvent[]
): void {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkTimeline(item, `${path}[${index}]`, resourceType, out)
    );
    return;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      const nextPath = path ? `${path}.${k}` : k;
      if (typeof v === 'string' && (DATE_KEYS.has(k) || k.toLowerCase().includes('date'))) {
        if (isIsoDate(v) || /^\d{4}-\d{2}-\d{2}/.test(v)) {
          out.push({
            id: nodeId(nextPath),
            label: k,
            date: v,
            isoDate: v.slice(0, 10),
            path: nextPath,
            resourceType
          });
        }
      } else if (k === 'period' && typeof v === 'object' && v) {
        const period = v as Record<string, unknown>;
        if (typeof period['start'] === 'string') {
          out.push({
            id: nodeId(`${nextPath}.start`),
            label: 'period.start',
            date: period['start'] as string,
            isoDate: (period['start'] as string).slice(0, 10),
            path: `${nextPath}.start`,
            resourceType
          });
        }
        if (typeof period['end'] === 'string') {
          out.push({
            id: nodeId(`${nextPath}.end`),
            label: 'period.end',
            date: period['end'] as string,
            isoDate: (period['end'] as string).slice(0, 10),
            path: `${nextPath}.end`,
            resourceType
          });
        }
      } else {
        walkTimeline(v, nextPath, resourceType, out);
      }
    }
  }
}

function extractResources(body: unknown): FhirResourceEntry[] {
  if (!body || typeof body !== 'object') return [];
  const obj = body as Record<string, unknown>;
  if (obj['resourceType'] === 'Bundle' && Array.isArray(obj['entry'])) {
    const entries: FhirResourceEntry[] = [];
    for (const item of obj['entry'] as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const resource = (item as Record<string, unknown>)['resource'];
      if (!resource || typeof resource !== 'object') continue;
      const res = resource as Record<string, unknown>;
      entries.push({
        resourceType: String(res['resourceType'] ?? 'Unknown'),
        id: typeof res['id'] === 'string' ? res['id'] : undefined,
        body: resource
      });
    }
    return entries.length ? entries : [{ resourceType: 'Bundle', id: typeof obj['id'] === 'string' ? obj['id'] : undefined, body }];
  }
  if (typeof obj['resourceType'] === 'string') {
    return [{
      resourceType: obj['resourceType'] as string,
      id: typeof obj['id'] === 'string' ? obj['id'] : undefined,
      body
    }];
  }
  return [];
}

function parseFhirJson(text: string): unknown {
  return JSON.parse(text);
}

function xmlElementToObject(el: Element): unknown {
  const children = Array.from(el.children);
  if (!children.length) {
    const text = el.textContent?.trim() ?? '';
    if (el.hasAttribute('value')) return el.getAttribute('value');
    return text || null;
  }
  const obj: Record<string, unknown> = {};
  for (const child of children) {
    const localName = child.localName;
    const value = xmlElementToObject(child);
    if (obj[localName] === undefined) {
      obj[localName] = value;
    } else if (Array.isArray(obj[localName])) {
      (obj[localName] as unknown[]).push(value);
    } else {
      obj[localName] = [obj[localName], value];
    }
  }
  return obj;
}

function parseFhirXml(text: string): unknown {
  if (typeof DOMParser === 'undefined') {
    throw new Error('FHIR XML parsing requires DOMParser (browser environment)');
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid FHIR XML document');
  }
  const root = doc.documentElement;
  if (!root) throw new Error('Empty FHIR XML document');
  const obj = xmlElementToObject(root) as Record<string, unknown>;
  if (root.localName) {
    return { resourceType: root.localName, ...obj };
  }
  return obj;
}

export function detectFhirFormat(text: string, extension: string): 'json' | 'xml' {
  const trimmed = text.trim();
  if (extension === '.xml' || trimmed.startsWith('<')) return 'xml';
  return 'json';
}

export function parseFhirText(text: string, extension: string): ParsedFhirDocument {
  const warnings: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty FHIR document');

  const format = detectFhirFormat(trimmed, extension);
  let body: unknown;
  try {
    body = format === 'xml' ? parseFhirXml(trimmed) : parseFhirJson(trimmed);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid FHIR document');
  }

  const resources = extractResources(body);
  if (!resources.length) {
    throw new Error('No FHIR resourceType found in document');
  }

  const rootObj = body as Record<string, unknown>;
  const isBundle = rootObj['resourceType'] === 'Bundle';
  const primaryResourceType = isBundle
    ? 'Bundle'
    : resources[0].resourceType;
  const primaryId = isBundle
    ? typeof rootObj['id'] === 'string'
      ? (rootObj['id'] as string)
      : resources[0].id
    : resources[0].id;

  const references: FhirReference[] = [];
  const timeline: FhirTimelineEvent[] = [];
  for (const resource of resources) {
    walkReferences(resource.body, resource.resourceType, references);
    walkTimeline(resource.body, resource.resourceType, resource.resourceType, timeline);
  }

  timeline.sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  const tree = [buildTree(body, 'root', 'root')];
  if (resources.length > 1 || isBundle) {
    warnings.push(`Bundle or multi-resource document with ${resources.length} embedded resource(s).`);
  }
  if (!references.length) {
    warnings.push('No FHIR references detected in this document.');
  }
  if (!timeline.length) {
    warnings.push('No date fields detected for timeline view.');
  }

  return {
    resources,
    primaryResourceType,
    primaryId,
    references,
    timeline,
    tree,
    warnings
  };
}

export function parseFhirBytes(bytes: Uint8Array, extension: string): ParsedFhirDocument {
  return parseFhirText(decodeUtf8(bytes), extension);
}

export function buildSampleFhirBundleJson(): string {
  return JSON.stringify(
    {
      resourceType: 'Bundle',
      type: 'collection',
      id: 'sample-clinical-bundle',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'patient-001',
            name: [{ family: 'Doe', given: ['John', 'M'] }],
            gender: 'male',
            birthDate: '1980-01-15'
          }
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-wbc',
            status: 'final',
            code: { text: 'White Blood Cells' },
            subject: { reference: 'Patient/patient-001', display: 'John Doe' },
            effectiveDateTime: '2024-01-15T10:15:00Z',
            valueQuantity: { value: 7.2, unit: '10*3/uL' }
          }
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-hgb',
            status: 'final',
            code: { text: 'Hemoglobin' },
            subject: { reference: 'Patient/patient-001', display: 'John Doe' },
            effectiveDateTime: '2024-01-15T10:15:00Z',
            valueQuantity: { value: 14.1, unit: 'g/dL' }
          }
        }
      ]
    },
    null,
    0
  );
}

export function filterFhirReferences(refs: FhirReference[], query: string): FhirReference[] {
  const q = query.trim().toLowerCase();
  if (!q) return refs;
  return refs.filter(
    (r) =>
      r.reference.toLowerCase().includes(q) ||
      r.path.toLowerCase().includes(q) ||
      r.display?.toLowerCase().includes(q)
  );
}

export function filterFhirTimeline(events: FhirTimelineEvent[], query: string): FhirTimelineEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return events;
  return events.filter(
    (e) =>
      e.label.toLowerCase().includes(q) ||
      e.date.toLowerCase().includes(q) ||
      e.path.toLowerCase().includes(q)
  );
}
