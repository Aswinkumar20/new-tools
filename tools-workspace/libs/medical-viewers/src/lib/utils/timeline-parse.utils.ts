import type { ClinicalTimelineEvent, ParsedTimelineDocument } from '../types/medical-timeline-viewer.types';
import { parseFhirText } from './fhir-parse.utils';
import { parseHl7Text } from './hl7-parse.utils';

const DEFAULT_CATEGORIES = ['encounter', 'lab', 'imaging', 'medication', 'procedure', 'diagnosis', 'other'];

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function normalizeIsoDate(value: string): string {
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{14}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return trimmed.slice(0, 10);
}

function createEventId(prefix: string, index: number): string {
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

function sortEvents(events: ClinicalTimelineEvent[]): ClinicalTimelineEvent[] {
  return [...events].sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.title.localeCompare(b.title));
}

function parseCsvTimeline(text: string, warnings: string[]): ParsedTimelineDocument {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length < 2) {
    throw new Error('CSV timeline needs a header row and at least one event row');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = header.findIndex((h) => h === 'date' || h === 'datetime' || h === 'time');
  const titleIdx = header.findIndex((h) => h === 'title' || h === 'event' || h === 'name');
  const categoryIdx = header.findIndex((h) => h === 'category' || h === 'type');
  const descIdx = header.findIndex((h) => h === 'description' || h === 'details' || h === 'notes');
  const patientIdx = header.findIndex((h) => h === 'patient' || h === 'patientid');

  if (dateIdx < 0 || titleIdx < 0) {
    throw new Error('CSV header must include date and title columns');
  }

  const events: ClinicalTimelineEvent[] = [];
  let patientLabel: string | undefined;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const date = cells[dateIdx] ?? '';
    const title = cells[titleIdx] ?? '';
    if (!date || !title) continue;
    if (patientIdx >= 0 && cells[patientIdx] && !patientLabel) {
      patientLabel = cells[patientIdx];
    }
    events.push({
      id: createEventId('csv', i),
      date,
      isoDate: normalizeIsoDate(date),
      title,
      category: categoryIdx >= 0 ? (cells[categoryIdx] || 'other') : 'other',
      description: descIdx >= 0 ? cells[descIdx] : undefined,
      source: 'csv',
      patientLabel
    });
  }

  if (!events.length) {
    throw new Error('CSV timeline contains no valid events');
  }

  return { events: sortEvents(events), patientLabel, warnings };
}

function parseJsonTimeline(text: string, warnings: string[]): ParsedTimelineDocument {
  const raw = JSON.parse(text) as {
    patient?: string;
    patientLabel?: string;
    events?: Array<{
      date?: string;
      title?: string;
      category?: string;
      description?: string;
      source?: string;
    }>;
  };

  const patientLabel = raw.patient ?? raw.patientLabel;
  const events: ClinicalTimelineEvent[] = [];

  for (let i = 0; i < (raw.events?.length ?? 0); i++) {
    const item = raw.events![i];
    if (!item?.date || !item?.title) {
      warnings.push(`Event ${i + 1} missing date or title — skipped.`);
      continue;
    }
    events.push({
      id: createEventId('json', i),
      date: item.date,
      isoDate: normalizeIsoDate(item.date),
      title: item.title,
      category: item.category || 'other',
      description: item.description,
      source: item.source || 'json',
      patientLabel
    });
  }

  if (!events.length) {
    throw new Error('JSON timeline has no valid events');
  }

  return { events: sortEvents(events), patientLabel, warnings };
}

function parseFhirTimeline(text: string, warnings: string[]): ParsedTimelineDocument {
  const fhir = parseFhirText(text, '.json');
  const events: ClinicalTimelineEvent[] = fhir.timeline.map((item, index) => ({
    id: createEventId('fhir', index),
    date: item.date,
    isoDate: item.isoDate,
    title: `${item.resourceType ?? 'Resource'} · ${item.label}`,
    category: mapFhirLabelToCategory(item.label),
    description: item.path,
    source: 'fhir',
    patientLabel: fhir.primaryResourceType === 'Patient' ? fhir.primaryId : undefined
  }));

  if (!events.length) {
    throw new Error('FHIR document has no extractable timeline dates');
  }

  warnings.push(...fhir.warnings);
  return {
    events: sortEvents(events),
    patientLabel: fhir.primaryId,
    warnings
  };
}

function parseHl7Timeline(text: string, warnings: string[]): ParsedTimelineDocument {
  const hl7 = parseHl7Text(text);
  const events: ClinicalTimelineEvent[] = [];
  let index = 0;

  if (hl7.messageType) {
    const msh = hl7.segments.find((s) => s.name === 'MSH');
    const date = msh?.fields[7]?.value;
    if (date) {
      events.push({
        id: createEventId('hl7', index++),
        date,
        isoDate: normalizeIsoDate(date),
        title: `${hl7.messageType}^${hl7.triggerEvent} message`,
        category: 'message',
        description: hl7.messageControlId,
        source: 'hl7'
      });
    }
  }

  for (const seg of hl7.segments) {
    if (seg.name === 'OBR') {
      const date = seg.fields[7]?.value;
      const service = seg.fields[4]?.value;
      if (date && service) {
        events.push({
          id: createEventId('hl7', index++),
          date,
          isoDate: normalizeIsoDate(date),
          title: service.split('^')[0] || 'Observation order',
          category: 'lab',
          description: seg.fields[4]?.value,
          source: 'hl7'
        });
      }
    }
    if (seg.name === 'EVN') {
      const date = seg.fields[2]?.value;
      const type = seg.fields[1]?.value;
      if (date) {
        events.push({
          id: createEventId('hl7', index++),
          date,
          isoDate: normalizeIsoDate(date),
          title: type ? `Event ${type}` : 'Clinical event',
          category: 'encounter',
          source: 'hl7'
        });
      }
    }
  }

  if (!events.length) {
    throw new Error('HL7 message has no extractable timeline events');
  }

  warnings.push(...hl7.warnings);
  return { events: sortEvents(events), warnings };
}

function mapFhirLabelToCategory(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('birth')) return 'encounter';
  if (lower.includes('effective') || lower.includes('issued')) return 'lab';
  if (lower.includes('period')) return 'encounter';
  return 'other';
}

function detectTimelineFormat(text: string, extension: string): 'json' | 'csv' | 'fhir' | 'hl7' {
  const trimmed = text.trim();
  if (extension === '.csv') return 'csv';
  if (extension === '.hl7') return 'hl7';
  if (trimmed.startsWith('MSH|')) return 'hl7';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const raw = JSON.parse(trimmed) as { resourceType?: string; events?: unknown[] };
      if (raw.resourceType) return 'fhir';
      if (Array.isArray(raw.events)) return 'json';
      if (trimmed.includes('"resourceType"')) return 'fhir';
      return 'json';
    } catch {
      return 'json';
    }
  }
  return 'csv';
}

export function parseTimelineText(text: string, extension: string): ParsedTimelineDocument & { format: 'json' | 'csv' | 'fhir' | 'hl7' } {
  const warnings: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty timeline document');

  const format = detectTimelineFormat(trimmed, extension.toLowerCase());
  let parsed: ParsedTimelineDocument;

  if (format === 'hl7') {
    parsed = parseHl7Timeline(trimmed, warnings);
  } else if (format === 'fhir') {
    parsed = parseFhirTimeline(trimmed, warnings);
  } else if (format === 'csv') {
    parsed = parseCsvTimeline(trimmed, warnings);
  } else {
    parsed = parseJsonTimeline(trimmed, warnings);
  }

  const categories = new Set(parsed.events.map((e) => e.category));
  for (const cat of categories) {
    if (!DEFAULT_CATEGORIES.includes(cat) && cat !== 'message') {
      warnings.push(`Non-standard category "${cat}" — filters still apply.`);
      break;
    }
  }

  return { ...parsed, format, warnings: [...parsed.warnings, ...warnings] };
}

export function parseTimelineBytes(bytes: Uint8Array, extension: string) {
  return parseTimelineText(decodeUtf8(bytes), extension);
}

export function buildSampleTimelineJson(): string {
  return JSON.stringify(
    {
      patient: 'John Doe',
      events: [
        {
          date: '2023-06-12',
          title: 'Annual physical',
          category: 'encounter',
          description: 'Routine wellness visit'
        },
        {
          date: '2024-01-10',
          title: 'Follow-up visit',
          category: 'encounter',
          description: 'Review prior labs'
        },
        {
          date: '2024-01-15T10:15:00Z',
          title: 'CBC panel',
          category: 'lab',
          description: 'WBC 7.2, Hgb 14.1'
        },
        {
          date: '2024-02-03',
          title: 'Chest X-ray',
          category: 'imaging',
          description: 'Ordered for cough evaluation'
        },
        {
          date: '2024-02-20',
          title: 'Amoxicillin prescribed',
          category: 'medication',
          description: '5-day course'
        }
      ]
    },
    null,
    0
  );
}

export function filterTimelineEvents(
  events: ClinicalTimelineEvent[],
  query: string,
  category: string | null
): ClinicalTimelineEvent[] {
  const q = query.trim().toLowerCase();
  return events.filter((event) => {
    if (category && event.category !== category) return false;
    if (!q) return true;
    return (
      event.title.toLowerCase().includes(q) ||
      event.category.toLowerCase().includes(q) ||
      event.description?.toLowerCase().includes(q) ||
      event.date.toLowerCase().includes(q)
    );
  });
}

export function categoryCounts(events: ClinicalTimelineEvent[]): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function groupTimelineEvents(
  events: ClinicalTimelineEvent[],
  mode: 'none' | 'month' | 'category'
): Array<{ key: string; label: string; events: ClinicalTimelineEvent[] }> {
  if (mode === 'none') {
    return [{ key: 'all', label: 'All events', events }];
  }

  const groups = new Map<string, ClinicalTimelineEvent[]>();
  for (const event of events) {
    const key =
      mode === 'month'
        ? event.isoDate.slice(0, 7)
        : event.category;
    const label =
      mode === 'month'
        ? formatMonthLabel(key)
        : event.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupedEvents]) => ({
      key,
      label: mode === 'month' ? formatMonthLabel(key) : key,
      events: groupedEvents
    }));
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  if (!year || !month) return key;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function exportTimelineEventsCsv(events: ClinicalTimelineEvent[]): string {
  const header = 'date,title,category,description,source';
  const rows = events.map((e) =>
    [e.date, e.title, e.category, e.description ?? '', e.source ?? '']
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}
