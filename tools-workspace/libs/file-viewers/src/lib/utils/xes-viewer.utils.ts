import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  XES_CONCEPT_NAME,
  XES_LIFECYCLE_TRANSITION,
  XES_MAX_FILE_BYTES,
  XES_ORG_RESOURCE,
  XES_SUPPORTED_EXTENSIONS,
  XES_TIME_TIMESTAMP,
  XES_TOP_ACTIVITIES,
  XES_TOP_CASE_HIGHLIGHTS,
  XES_TOP_INSIGHT_ITEMS,
  XES_TOP_VARIANTS
} from '../constants/xes-viewer.constants';
import type {
  Pm4jsApi,
  Pm4jsAttribute,
  Pm4jsEventLog,
  Pm4jsGeneralLogStatistics,
  Pm4jsTrace,
  Pm4jsXesImporter,
  XesActivityCount,
  XesCaseHighlight,
  XesDistributionBucket,
  XesEventRow,
  XesKeyValue,
  XesLogInsights,
  XesLogMetadata,
  XesLogStats,
  XesRankedCount,
  XesReportPayload,
  XesTraceSummary,
  XesVariantCoverage
} from '../types/xes-viewer.types';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * PM4JS is written as Node CommonJS files: every module publishes its classes
 * by assigning them to `global`, and later modules resolve earlier ones through
 * that same object. So we shim `global`, import the four modules the viewer
 * needs in dependency order, then read the classes back off the global object.
 *
 * Only these modules are imported on purpose — the full `dist` bundle pulls in
 * `jsdom`, which cannot be bundled for the browser.
 */
interface Pm4jsGlobalScope {
  global?: unknown;
  DOMParser?: typeof DOMParser;
  XesImporter?: Pm4jsXesImporter;
  GeneralLogStatistics?: Pm4jsGeneralLogStatistics;
}

let pm4jsLoadPromise: Promise<Pm4jsApi> | null = null;

function pm4jsScope(): Pm4jsGlobalScope {
  return globalThis as unknown as Pm4jsGlobalScope;
}

export function getPm4jsImporter(): Pm4jsXesImporter | null {
  return pm4jsScope().XesImporter ?? null;
}

export function getPm4jsStatistics(): Pm4jsGeneralLogStatistics | undefined {
  return pm4jsScope().GeneralLogStatistics;
}

async function importPm4jsModules(): Promise<Pm4jsApi> {
  const scope = pm4jsScope();
  scope.global ??= globalThis;

  const nativeDomParser = scope.DOMParser;
  try {
    // @ts-expect-error pm4js deep CJS paths have no package types
    await import('pm4js/pm4js/pm4js.js');
    // @ts-expect-error pm4js deep CJS paths have no package types
    await import('pm4js/pm4js/objects/log/log.js');
    // @ts-expect-error pm4js deep CJS paths have no package types
    await import('pm4js/pm4js/objects/log/importer/xes/importer.js');
    // @ts-expect-error pm4js deep CJS paths have no package types
    await import('pm4js/pm4js/statistics/log/general.js');
  } finally {
    // The importer swaps in xmldom's parser for Node; keep the browser's.
    if (nativeDomParser) {
      scope.DOMParser = nativeDomParser;
    }
  }

  const importer = scope.XesImporter;
  if (typeof importer?.apply !== 'function') {
    throw new Error('PM4JS loaded but exposed no XES importer.');
  }
  return { XesImporter: importer, GeneralLogStatistics: scope.GeneralLogStatistics };
}

/** Loads PM4JS from the installed npm package (bundled, no network request). */
export function loadPm4js(): Promise<Pm4jsApi> {
  pm4jsLoadPromise ??= importPm4jsModules().catch((error: unknown) => {
    pm4jsLoadPromise = null;
    throw error instanceof Error ? error : new Error('Failed to load PM4JS');
  });
  return pm4jsLoadPromise;
}

export function getXesFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return `.${parts.pop()?.toLowerCase() ?? ''}`;
}

export function isSupportedXesFile(
  file: Pick<File, 'name' | 'type'>,
  extensions: ReadonlyArray<string> = XES_SUPPORTED_EXTENSIONS
): boolean {
  const ext = getXesFileExtension(file.name);
  if (extensions.includes(ext)) {
    return true;
  }
  const type = file.type.toLowerCase();
  return type.includes('xml') || type === 'application/xes+xml';
}

export function filterValidXesFiles(files: ReadonlyArray<File>): File[] {
  return files.filter((file) => isSupportedXesFile(file));
}

export function formatXesFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function validateXesFileSize(
  file: Pick<File, 'size' | 'name'>,
  maxBytes: number = XES_MAX_FILE_BYTES
): string | null {
  if (file.size > maxBytes) {
    return `"${file.name}" is ${formatXesFileSize(file.size)} (max ${formatXesFileSize(maxBytes)}).`;
  }
  return null;
}

/** Read a text file in browsers and Jest/jsdom (where `File.text` may be missing). */
export async function readXesFileText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    // FileReader fallback for older jsdom / browsers without Blob.text().
    reader.readAsText(file);
  });
}

export function parseXesWithPm4js(xmlString: string, importer: Pm4jsXesImporter): Pm4jsEventLog {
  const trimmed = xmlString.trim();
  if (!trimmed) {
    throw new Error('The file is empty');
  }
  if (!/<log[\s>]/i.test(trimmed) && !/<log:/i.test(trimmed)) {
    throw new Error('Not a valid XES event log (missing <log> root)');
  }

  const log = importer.apply(trimmed);
  if (!log?.traces) {
    throw new Error('PM4JS could not parse this XES file');
  }
  return log;
}

export function attrValue(
  attributes: Record<string, Pm4jsAttribute> | undefined,
  key: string
): string {
  if (!attributes || !(key in attributes)) {
    return '';
  }
  const raw = attributes[key]?.value;
  if (raw === undefined || raw === null) {
    return '';
  }
  if (raw instanceof Date) {
    return raw.toISOString();
  }
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }
  return '';
}

export function attrDateMs(
  attributes: Record<string, Pm4jsAttribute> | undefined,
  key: string = XES_TIME_TIMESTAMP
): number | null {
  if (!attributes || !(key in attributes)) {
    return null;
  }
  const raw = attributes[key]?.value;
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

export function formatXesTimestamp(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(ms));
}

/** Flattens every attribute of an XES element into displayable key/value pairs. */
export function toKeyValues(
  attributes: Record<string, Pm4jsAttribute> | undefined
): XesKeyValue[] {
  if (!attributes) {
    return [];
  }
  return Object.keys(attributes)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, value: attrValue(attributes, key) }));
}

export function formatXesDuration(fromMs: number | null, toMs: number | null): string {
  if (fromMs === null || toMs === null) {
    return '—';
  }
  const totalSeconds = Math.max(0, Math.round((toMs - fromMs) / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function resolveCaseId(trace: Pm4jsTrace, index: number): string {
  return (
    attrValue(trace.attributes, XES_CONCEPT_NAME) ||
    attrValue(trace.attributes, 'case:concept:name') ||
    `Case ${index + 1}`
  );
}

export function flattenXesEvents(log: Pm4jsEventLog): XesEventRow[] {
  const rows: XesEventRow[] = [];
  log.traces.forEach((trace, traceIndex) => {
    const caseId = resolveCaseId(trace, traceIndex);

    trace.events.forEach((event, eventIndex) => {
      const timestampMs = attrDateMs(event.attributes);

      rows.push({
        id: `${traceIndex}-${eventIndex}`,
        caseId,
        activity: attrValue(event.attributes, XES_CONCEPT_NAME) || '(unnamed)',
        timestamp: formatXesTimestamp(timestampMs),
        timestampMs,
        resource: attrValue(event.attributes, XES_ORG_RESOURCE) || '—',
        lifecycle: attrValue(event.attributes, XES_LIFECYCLE_TRANSITION) || '—',
        traceIndex,
        eventIndex,
        attributes: toKeyValues(event.attributes)
      });
    });
  });
  return rows;
}

export function buildXesTraceSummaries(log: Pm4jsEventLog): XesTraceSummary[] {
  return log.traces.map((trace, index) => {
    const activities = trace.events.map(
      (event) => attrValue(event.attributes, XES_CONCEPT_NAME) || '(unnamed)'
    );
    let minMs: number | null = null;
    let maxMs: number | null = null;
    for (const event of trace.events) {
      const ms = attrDateMs(event.attributes);
      if (ms === null) {
        continue;
      }
      minMs = minMs === null ? ms : Math.min(minMs, ms);
      maxMs = maxMs === null ? ms : Math.max(maxMs, ms);
    }
    return {
      index,
      caseId: resolveCaseId(trace, index),
      eventCount: trace.events.length,
      startTime: formatXesTimestamp(minMs),
      endTime: formatXesTimestamp(maxMs),
      durationLabel: formatXesDuration(minMs, maxMs),
      durationMs: minMs !== null && maxMs !== null ? Math.max(0, maxMs - minMs) : null,
      activities,
      attributes: toKeyValues(trace.attributes)
    };
  });
}

/** Reads the XES header: log attributes, extensions, classifiers and globals. */
export function buildXesLogMetadata(
  log: Pm4jsEventLog,
  rows: ReadonlyArray<XesEventRow>
): XesLogMetadata {
  const eventKeys = new Set<string>();
  for (const row of rows) {
    for (const attribute of row.attributes) {
      eventKeys.add(attribute.key);
    }
  }

  const traceKeys = new Set<string>();
  for (const trace of log.traces) {
    for (const key of Object.keys(trace.attributes || {})) {
      traceKeys.add(key);
    }
  }

  const extensions = Object.entries(log.extensions || {}).map(([name, value]) => ({
    name,
    prefix: value?.[0] ?? '',
    uri: value?.[1] ?? ''
  }));

  const classifiers = Object.entries(log.classifiers || {}).map(([name, keys]) => ({
    name,
    keys: String(keys ?? '')
  }));

  const globals = Object.entries(log.globals || {}).map(([scope, value]) => ({
    scope,
    attributes: toKeyValues(value?.attributes)
  }));

  return {
    name: attrValue(log.attributes, XES_CONCEPT_NAME) || 'Untitled log',
    attributes: toKeyValues(log.attributes),
    extensions,
    classifiers,
    globals,
    eventAttributeKeys: [...eventKeys].sort((a, b) => a.localeCompare(b)),
    traceAttributeKeys: [...traceKeys].sort((a, b) => a.localeCompare(b))
  };
}

export function countMapToSortedList(
  counts: Record<string, number>,
  limit: number
): XesActivityCount[] {
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildXesActivityCounts(rows: ReadonlyArray<XesEventRow>): XesActivityCount[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.activity] = (counts[row.activity] || 0) + 1;
  }
  return countMapToSortedList(counts, XES_TOP_ACTIVITIES);
}

export function buildXesVariantCounts(
  log: Pm4jsEventLog,
  statsApi: Pm4jsGeneralLogStatistics | undefined = getPm4jsStatistics()
): XesActivityCount[] {
  if (statsApi?.getVariants) {
    const variants = statsApi.getVariants(log, XES_CONCEPT_NAME);
    return countMapToSortedList(
      Object.fromEntries(
        Object.entries(variants).map(([name, count]) => [
          name.replace(/,/g, ' → '),
          count
        ])
      ),
      XES_TOP_VARIANTS
    );
  }

  const counts: Record<string, number> = {};
  for (const trace of log.traces) {
    const key = trace.events
      .map((event) => attrValue(event.attributes, XES_CONCEPT_NAME) || '(unnamed)')
      .join(' → ');
    counts[key || '(empty)'] = (counts[key || '(empty)'] || 0) + 1;
  }
  return countMapToSortedList(counts, XES_TOP_VARIANTS);
}

export function buildXesLogStats(
  log: Pm4jsEventLog,
  rows: ReadonlyArray<XesEventRow>,
  statsApi: Pm4jsGeneralLogStatistics | undefined = getPm4jsStatistics()
): XesLogStats {
  const eventCount = statsApi?.numEvents ? statsApi.numEvents(log) : rows.length;
  const activities = new Set(rows.map((row) => row.activity));
  const resources = new Set(rows.map((row) => row.resource).filter((r) => r && r !== '—'));
  const variants = buildXesVariantCounts(log, statsApi);
  const startActs = statsApi?.getStartActivities
    ? Object.keys(statsApi.getStartActivities(log, XES_CONCEPT_NAME)).length
    : 0;
  const endActs = statsApi?.getEndActivities
    ? Object.keys(statsApi.getEndActivities(log, XES_CONCEPT_NAME)).length
    : 0;

  let minMs: number | null = null;
  let maxMs: number | null = null;
  for (const row of rows) {
    if (row.timestampMs === null) {
      continue;
    }
    minMs = minMs === null ? row.timestampMs : Math.min(minMs, row.timestampMs);
    maxMs = maxMs === null ? row.timestampMs : Math.max(maxMs, row.timestampMs);
  }

  let timeSpanLabel = '—';
  if (minMs !== null && maxMs !== null) {
    const days = Math.max(1, Math.round((maxMs - minMs) / (24 * 60 * 60 * 1000)));
    timeSpanLabel = days === 1 ? '1 day' : `${days} days`;
  }

  return {
    cases: log.traces.length,
    events: eventCount,
    activities: activities.size,
    variants: variants.length,
    resources: resources.size,
    startActivities: startActs,
    endActivities: endActs,
    timeSpanLabel
  };
}

export function filterXesEventRows(
  rows: ReadonlyArray<XesEventRow>,
  options: {
    searchText: string;
    caseId: string | null;
    activity: string | null;
  }
): XesEventRow[] {
  const query = options.searchText.trim().toLowerCase();
  return rows.filter((row) => {
    if (options.caseId && row.caseId !== options.caseId) {
      return false;
    }
    if (options.activity && row.activity !== options.activity) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      row.caseId.toLowerCase().includes(query) ||
      row.activity.toLowerCase().includes(query) ||
      row.resource.toLowerCase().includes(query) ||
      row.lifecycle.toLowerCase().includes(query) ||
      row.timestamp.toLowerCase().includes(query) ||
      row.attributes.some(
        (attribute) =>
          attribute.key.toLowerCase().includes(query) ||
          attribute.value.toLowerCase().includes(query)
      )
    );
  });
}

/** Exports every event attribute, one column per key found in the log. */
export function exportXesEventsAsCsv(
  rows: ReadonlyArray<XesEventRow>,
  delimiter = ','
): string {
  const attributeKeys = [
    ...new Set(rows.flatMap((row) => row.attributes.map((attribute) => attribute.key)))
  ].sort((a, b) => a.localeCompare(b));

  const lines = [['case_id', ...attributeKeys].map((cell) => escapeDelimitedCell(cell, delimiter)).join(delimiter)];
  for (const row of rows) {
    const lookup = new Map(row.attributes.map((attribute) => [attribute.key, attribute.value]));
    lines.push(
      [row.caseId, ...attributeKeys.map((key) => lookup.get(key) ?? '')]
        .map((cell) => escapeDelimitedCell(cell, delimiter))
        .join(delimiter)
    );
  }
  return lines.join('\n');
}

export function exportXesEventsAsJson(rows: ReadonlyArray<XesEventRow>): string {
  return JSON.stringify(
    rows.map((row) => ({
      caseId: row.caseId,
      activity: row.activity,
      timestamp: row.timestamp,
      resource: row.resource,
      lifecycle: row.lifecycle,
      attributes: Object.fromEntries(row.attributes.map((attribute) => [attribute.key, attribute.value]))
    })),
    null,
    2
  );
}

export function exportXesTimelineAsCsv(rows: ReadonlyArray<XesEventRow>): string {
  const caseStarts = new Map<string, number>();
  for (const row of rows) {
    if (row.timestampMs === null) {
      continue;
    }
    const current = caseStarts.get(row.caseId);
    if (current === undefined || row.timestampMs < current) {
      caseStarts.set(row.caseId, row.timestampMs);
    }
  }

  const lines = [
    ['case_id', 'activity', 'timestamp', 'relative_seconds', 'resource', 'lifecycle']
      .map((cell) => escapeDelimitedCell(cell, ','))
      .join(',')
  ];
  for (const row of rows) {
    const start = caseStarts.get(row.caseId);
    const relative =
      row.timestampMs !== null && start !== undefined
        ? String(Math.max(0, Math.round((row.timestampMs - start) / 1000)))
        : '';
    lines.push(
      [row.caseId, row.activity, row.timestamp, relative, row.resource, row.lifecycle]
        .map((cell) => escapeDelimitedCell(cell, ','))
        .join(',')
    );
  }
  return lines.join('\n');
}

export function exportXesCasesAsCsv(traces: ReadonlyArray<XesTraceSummary>): string {
  const lines = [
    ['case_id', 'event_count', 'start', 'end', 'duration', 'path']
      .map((cell) => escapeDelimitedCell(cell, ','))
      .join(',')
  ];
  for (const trace of traces) {
    lines.push(
      [
        trace.caseId,
        String(trace.eventCount),
        trace.startTime,
        trace.endTime,
        trace.durationLabel,
        trace.activities.join(' → ')
      ]
        .map((cell) => escapeDelimitedCell(cell, ','))
        .join(',')
    );
  }
  return lines.join('\n');
}

export function exportXesCasesAsJson(traces: ReadonlyArray<XesTraceSummary>): string {
  return JSON.stringify(
    traces.map((trace) => ({
      caseId: trace.caseId,
      eventCount: trace.eventCount,
      startTime: trace.startTime,
      endTime: trace.endTime,
      durationLabel: trace.durationLabel,
      durationMs: trace.durationMs,
      path: trace.activities,
      attributes: Object.fromEntries(
        trace.attributes.map((attribute) => [attribute.key, attribute.value])
      )
    })),
    null,
    2
  );
}

export function exportXesCountsAsCsv(
  items: ReadonlyArray<XesActivityCount | XesRankedCount>,
  nameHeader: string,
  countHeader: string,
  includeShare = false
): string {
  const headers = includeShare
    ? [nameHeader, countHeader, 'share_pct']
    : [nameHeader, countHeader];
  const lines = [headers.map((cell) => escapeDelimitedCell(cell, ',')).join(',')];
  for (const item of items) {
    const cells = [item.name, String(item.count)];
    if (includeShare && 'share' in item) {
      cells.push(item.share.toFixed(2));
    }
    lines.push(cells.map((cell) => escapeDelimitedCell(cell, ',')).join(','));
  }
  return lines.join('\n');
}

export function exportXesStartEndAsCsv(insights: XesLogInsights): string {
  const lines = [
    ['kind', 'activity', 'count', 'share_pct']
      .map((cell) => escapeDelimitedCell(cell, ','))
      .join(',')
  ];
  for (const item of insights.startActivities) {
    lines.push(
      ['start', item.name, String(item.count), item.share.toFixed(2)]
        .map((cell) => escapeDelimitedCell(cell, ','))
        .join(',')
    );
  }
  for (const item of insights.endActivities) {
    lines.push(
      ['end', item.name, String(item.count), item.share.toFixed(2)]
        .map((cell) => escapeDelimitedCell(cell, ','))
        .join(',')
    );
  }
  return lines.join('\n');
}

/** Graphviz DOT for the directly-follows graph (top transitions). */
export function exportXesDfgAsDot(transitions: ReadonlyArray<XesRankedCount>): string {
  const lines = [
    'digraph XES_DFG {',
    '  rankdir=LR;',
    '  node [shape=box, style="rounded,filled", fillcolor="#eef5ff", color="#075fbd", fontname="Helvetica"];',
    '  edge [color="#64748b", fontname="Helvetica", fontsize=10];'
  ];
  for (const item of transitions) {
    const parts = item.name.split(' → ');
    if (parts.length !== 2) {
      continue;
    }
    lines.push(
      `  ${JSON.stringify(parts[0])} -> ${JSON.stringify(parts[1])} [label=${JSON.stringify(String(item.count))}];`
    );
  }
  lines.push('}');
  return lines.join('\n');
}

export function exportXesSummaryAsJson(payload: XesReportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function exportXesMarkdownReport(payload: XesReportPayload): string {
  const { fileName, stats, insights, activities, variants } = payload;
  const lines = [
    `# XES analytics report`,
    '',
    `- **File:** ${fileName}`,
    `- **Generated:** ${new Date().toISOString()}`,
    ''
  ];

  if (stats) {
    lines.push(
      '## Overview',
      '',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Cases | ${stats.cases} |`,
      `| Events | ${stats.events} |`,
      `| Activities | ${stats.activities} |`,
      `| Variants | ${stats.variants} |`,
      `| Resources | ${stats.resources} |`,
      `| Time span | ${stats.timeSpanLabel} |`,
      ''
    );
  }

  if (insights) {
    lines.push('## Key findings', '');
    for (const finding of insights.findings) {
      lines.push(`- ${finding}`);
    }
    lines.push(
      '',
      '## Shape',
      '',
      `- Avg events / case: **${insights.avgEventsPerCase}** (median ${insights.medianEventsPerCase})`,
      `- Avg duration: **${insights.avgDurationLabel}** (median ${insights.medianDurationLabel})`,
      `- Path diversity: **${insights.variantCoverage}%**`,
      `- Rework cases: **${insights.reworkCaseShare}%**`,
      `- Self-loops: **${insights.selfLoopCount}**`,
      `- Throughput: **${insights.eventsPerDayLabel}**`,
      '',
      '### Top transitions',
      ''
    );
    for (const item of insights.transitions.slice(0, 10)) {
      lines.push(`- ${item.name} — ${item.count} (${item.share.toFixed(1)}%)`);
    }
    lines.push('', '### Variant coverage', '');
    for (const item of insights.variantPareto.slice(0, 10)) {
      lines.push(
        `- ${item.name} — ${item.count} cases (${item.share.toFixed(1)}%, cumulative ${item.cumulativeShare.toFixed(1)}%)`
      );
    }
    lines.push('');
  }

  if (activities.length > 0) {
    lines.push('## Top activities', '');
    for (const item of activities.slice(0, 12)) {
      lines.push(`- ${item.name} — ${item.count}`);
    }
    lines.push('');
  }

  if (variants.length > 0) {
    lines.push('## Top variants', '');
    for (const item of variants.slice(0, 10)) {
      lines.push(`- ${item.name} — ${item.count}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function pushReportCsvRows(
  lines: string[],
  section: string,
  rows: ReadonlyArray<{ item: string; value: string; share?: string; detail?: string }>
): void {
  for (const row of rows) {
    lines.push(
      [section, row.item, row.value, row.share ?? '', row.detail ?? '']
        .map((cell) => escapeDelimitedCell(cell, ','))
        .join(',')
    );
  }
}

/** Flat workbook-style CSV covering the full analysis (sectioned rows). */
export function exportXesFullReportAsCsv(payload: XesReportPayload): string {
  const lines = [
    ['section', 'item', 'value', 'share_pct', 'detail']
      .map((cell) => escapeDelimitedCell(cell, ','))
      .join(',')
  ];

  lines.push(
    ['Meta', 'File', payload.fileName, '', '']
      .map((cell) => escapeDelimitedCell(cell, ','))
      .join(',')
  );
  lines.push(
    ['Meta', 'Generated', new Date().toISOString(), '', '']
      .map((cell) => escapeDelimitedCell(cell, ','))
      .join(',')
  );

  if (payload.stats) {
    const stats = payload.stats;
    pushReportCsvRows(lines, 'Overview', [
      { item: 'Cases', value: String(stats.cases) },
      { item: 'Events', value: String(stats.events) },
      { item: 'Activities', value: String(stats.activities) },
      { item: 'Variants', value: String(stats.variants) },
      { item: 'Resources', value: String(stats.resources) },
      { item: 'Start activities', value: String(stats.startActivities) },
      { item: 'End activities', value: String(stats.endActivities) },
      { item: 'Time span', value: stats.timeSpanLabel }
    ]);
  }

  if (payload.insights) {
    const insights = payload.insights;
    pushReportCsvRows(
      lines,
      'Findings',
      insights.findings.map((finding, index) => ({
        item: `Finding ${index + 1}`,
        value: finding
      }))
    );
    pushReportCsvRows(lines, 'Shape', [
      {
        item: 'Avg events / case',
        value: String(insights.avgEventsPerCase),
        detail: `median ${insights.medianEventsPerCase}; range ${insights.minEventsPerCase}-${insights.maxEventsPerCase}`
      },
      {
        item: 'Avg duration',
        value: insights.avgDurationLabel,
        detail: `median ${insights.medianDurationLabel}`
      },
      { item: 'Path diversity %', value: String(insights.variantCoverage) },
      { item: 'Rework cases %', value: String(insights.reworkCaseShare) },
      { item: 'Self-loops', value: String(insights.selfLoopCount) },
      { item: 'Throughput', value: insights.eventsPerDayLabel }
    ]);

    const rankedSections: Array<{
      section: string;
      items: ReadonlyArray<{ name: string; count: number; share: number }>;
    }> = [
      { section: 'Start activities', items: insights.startActivities },
      { section: 'End activities', items: insights.endActivities },
      { section: 'Resources', items: insights.resources },
      { section: 'Lifecycle', items: insights.lifecycleCounts },
      { section: 'Transitions', items: insights.transitions },
      { section: 'Rework activities', items: insights.reworkActivities },
      { section: 'Self-loops', items: insights.selfLoops }
    ];
    for (const block of rankedSections) {
      pushReportCsvRows(
        lines,
        block.section,
        block.items.map((item) => ({
          item: item.name,
          value: String(item.count),
          share: item.share.toFixed(2)
        }))
      );
    }

    pushReportCsvRows(
      lines,
      'Case length',
      insights.caseLengthBuckets.map((bucket) => ({
        item: bucket.label,
        value: String(bucket.count),
        share: bucket.share.toFixed(2)
      }))
    );
    pushReportCsvRows(
      lines,
      'Case duration',
      insights.durationBuckets.map((bucket) => ({
        item: bucket.label,
        value: String(bucket.count),
        share: bucket.share.toFixed(2)
      }))
    );
    pushReportCsvRows(
      lines,
      'Hourly activity',
      insights.hourlyBuckets.map((bucket) => ({
        item: bucket.label,
        value: String(bucket.count),
        share: bucket.share.toFixed(2)
      }))
    );
    pushReportCsvRows(
      lines,
      'Weekday activity',
      insights.weekdayBuckets.map((bucket) => ({
        item: bucket.label,
        value: String(bucket.count),
        share: bucket.share.toFixed(2)
      }))
    );
    pushReportCsvRows(
      lines,
      'Variant coverage',
      insights.variantPareto.map((item) => ({
        item: item.name,
        value: String(item.count),
        share: item.share.toFixed(2),
        detail: `cumulative ${item.cumulativeShare.toFixed(2)}%`
      }))
    );
    pushReportCsvRows(
      lines,
      'Longest cases',
      insights.longestCases.map((item) => ({
        item: item.caseId,
        value: item.durationLabel,
        detail: `${item.eventCount} events · ${item.pathPreview}`
      }))
    );
    pushReportCsvRows(
      lines,
      'Busiest cases',
      insights.busiestCases.map((item) => ({
        item: item.caseId,
        value: String(item.eventCount),
        detail: `${item.durationLabel} · ${item.pathPreview}`
      }))
    );
  }

  if (payload.metadata) {
    pushReportCsvRows(lines, 'Log metadata', [
      { item: 'Log name', value: payload.metadata.name },
      {
        item: 'Extensions',
        value: payload.metadata.extensions.map((item) => item.name).join('; ')
      },
      {
        item: 'Classifiers',
        value: payload.metadata.classifiers
          .map((item) => `${item.name}=${item.keys}`)
          .join('; ')
      },
      {
        item: 'Event attribute keys',
        value: payload.metadata.eventAttributeKeys.join('; ')
      },
      {
        item: 'Case attribute keys',
        value: payload.metadata.traceAttributeKeys.join('; ')
      }
    ]);
  }

  pushReportCsvRows(
    lines,
    'Top activities',
    payload.activities.map((item) => ({
      item: item.name,
      value: String(item.count)
    }))
  );
  pushReportCsvRows(
    lines,
    'Top variants',
    payload.variants.map((item) => ({
      item: item.name,
      value: String(item.count)
    }))
  );

  return lines.join('\n');
}

function wrapPdfText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }
  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const next = `${current} ${words[index]}`;
    if (next.length <= maxChars) {
      current = next;
    } else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(current);
  return lines;
}

/** Helvetica (WinAnsi) cannot encode arrows/dashes/bullets — normalize for PDF. */
function sanitizePdfText(value: string): string {
  return value
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[—–−]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
}

/** Multi-page printable PDF built with the already-installed pdf-lib package. */
export async function exportXesFullReportAsPdf(
  payload: XesReportPayload
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  const accent = rgb(0.03, 0.37, 0.74);
  const muted = rgb(0.39, 0.45, 0.55);
  const textColor = rgb(0.09, 0.13, 0.2);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed >= margin) {
      return;
    }
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const drawText = (
    value: string,
    options: { size?: number; font?: typeof regular; color?: ReturnType<typeof rgb>; indent?: number } = {}
  ) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const color = options.color ?? textColor;
    const indent = options.indent ?? 0;
    const maxChars = Math.max(24, Math.floor((maxWidth - indent) / (size * 0.52)));
    for (const line of wrapPdfText(sanitizePdfText(value), maxChars)) {
      ensureSpace(size + 4);
      page.drawText(line, {
        x: margin + indent,
        y: y - size,
        size,
        font,
        color
      });
      y -= size + 4;
    }
  };

  const section = (title: string) => {
    ensureSpace(28);
    y -= 8;
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: 3,
      height: 14,
      color: accent
    });
    drawText(title, { size: 12, font: bold, color: accent, indent: 8 });
    y -= 2;
  };

  const bullet = (value: string) => drawText(`- ${value}`, { size: 9.5, indent: 6 });

  drawText('XES Analytics Report', { size: 18, font: bold, color: accent });
  drawText(payload.fileName, { size: 11, font: bold });
  drawText(`Generated ${new Date().toLocaleString()} · EasyToolHub XES Viewer`, {
    size: 9,
    color: muted
  });
  y -= 6;

  if (payload.stats) {
    section('Overview');
    const stats = payload.stats;
    bullet(`Cases: ${stats.cases}`);
    bullet(`Events: ${stats.events}`);
    bullet(`Activities: ${stats.activities}`);
    bullet(`Variants: ${stats.variants}`);
    bullet(`Resources: ${stats.resources}`);
    bullet(`Start / end activities: ${stats.startActivities} / ${stats.endActivities}`);
    bullet(`Time span: ${stats.timeSpanLabel}`);
  }

  if (payload.insights) {
    const insights = payload.insights;
    section('Key findings');
    for (const finding of insights.findings) {
      bullet(finding);
    }

    section('Process shape');
    bullet(
      `Avg events / case: ${insights.avgEventsPerCase} (median ${insights.medianEventsPerCase}, range ${insights.minEventsPerCase}-${insights.maxEventsPerCase})`
    );
    bullet(`Avg duration: ${insights.avgDurationLabel} (median ${insights.medianDurationLabel})`);
    bullet(`Path diversity: ${insights.variantCoverage}%`);
    bullet(`Rework cases: ${insights.reworkCaseShare}%`);
    bullet(`Self-loops: ${insights.selfLoopCount}`);
    bullet(`Throughput: ${insights.eventsPerDayLabel}`);

    const rankedBlocks: Array<{ title: string; items: ReadonlyArray<XesRankedCount> }> = [
      { title: 'Start activities', items: insights.startActivities },
      { title: 'End activities', items: insights.endActivities },
      { title: 'Resources', items: insights.resources },
      { title: 'Top transitions', items: insights.transitions },
      { title: 'Rework activities', items: insights.reworkActivities }
    ];
    for (const block of rankedBlocks) {
      if (block.items.length === 0) {
        continue;
      }
      section(block.title);
      for (const item of block.items.slice(0, 8)) {
        bullet(`${item.name} — ${item.count} (${item.share.toFixed(1)}%)`);
      }
    }

    if (insights.variantPareto.length > 0) {
      section('Variant coverage');
      for (const item of insights.variantPareto.slice(0, 8)) {
        bullet(
          `${item.name} — ${item.count} cases (${item.share.toFixed(1)}%, cumulative ${item.cumulativeShare.toFixed(1)}%)`
        );
      }
    }

    if (insights.caseLengthBuckets.length > 0) {
      section('Case length distribution');
      for (const bucket of insights.caseLengthBuckets) {
        bullet(`${bucket.label}: ${bucket.count} (${bucket.share.toFixed(1)}%)`);
      }
    }

    if (insights.durationBuckets.length > 0) {
      section('Case duration distribution');
      for (const bucket of insights.durationBuckets) {
        bullet(`${bucket.label}: ${bucket.count} (${bucket.share.toFixed(1)}%)`);
      }
    }

    if (insights.longestCases.length > 0) {
      section('Longest cases');
      for (const item of insights.longestCases) {
        bullet(`${item.caseId} — ${item.durationLabel}, ${item.eventCount} events`);
      }
    }

    if (insights.busiestCases.length > 0) {
      section('Busiest cases');
      for (const item of insights.busiestCases) {
        bullet(`${item.caseId} — ${item.eventCount} events, ${item.durationLabel}`);
      }
    }
  }

  if (payload.activities.length > 0) {
    section('Top activities');
    for (const item of payload.activities.slice(0, 12)) {
      bullet(`${item.name} — ${item.count}`);
    }
  }

  if (payload.variants.length > 0) {
    section('Top variants');
    for (const item of payload.variants.slice(0, 10)) {
      bullet(`${item.name} — ${item.count}`);
    }
  }

  if (payload.metadata) {
    section('Log metadata');
    bullet(`Log name: ${payload.metadata.name}`);
    if (payload.metadata.extensions.length > 0) {
      bullet(
        `Extensions: ${payload.metadata.extensions.map((item) => item.name).join(', ')}`
      );
    }
    if (payload.metadata.classifiers.length > 0) {
      bullet(
        `Classifiers: ${payload.metadata.classifiers
          .map((item) => `${item.name} (${item.keys})`)
          .join('; ')}`
      );
    }
  }

  ensureSpace(24);
  y -= 8;
  drawText('Parsed locally with PM4JS — nothing uploaded to a server.', {
    size: 8,
    color: muted
  });

  return doc.save();
}

export async function exportXesFullReportAsPdfBlob(payload: XesReportPayload): Promise<Blob> {
  const bytes = await exportXesFullReportAsPdf(payload);
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

function escapeDelimitedCell(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes('\n') || value.includes(delimiter)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadTextFile(content: string, fileName: string, mime: string): void {
  if (globalThis.window === undefined) {
    return;
  }
  const blob = new Blob([content], { type: mime });
  downloadBlobFile(blob, fileName);
}

export function downloadBlobFile(blob: Blob, fileName: string): void {
  if (globalThis.window === undefined) {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function medianOfSorted(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return (values[mid - 1] + values[mid]) / 2;
  }
  return values[mid];
}

function toRankedCounts(
  counts: Record<string, number>,
  total: number,
  limit: number
): XesRankedCount[] {
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      share: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function bucketCounts(
  values: number[],
  edges: ReadonlyArray<{ max: number; label: string }>,
  overflowLabel: string
): XesDistributionBucket[] {
  const buckets = edges.map((edge) => ({ label: edge.label, count: 0, share: 0 }));
  let overflow = 0;
  for (const value of values) {
    const index = edges.findIndex((edge) => value <= edge.max);
    if (index >= 0) {
      buckets[index].count += 1;
    } else {
      overflow += 1;
    }
  }
  if (overflow > 0 || buckets.every((bucket) => bucket.count === 0)) {
    buckets.push({ label: overflowLabel, count: overflow, share: 0 });
  }
  const total = values.length;
  return buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      ...bucket,
      share: total > 0 ? (bucket.count / total) * 100 : 0
    }));
}

function collectEndpointCounts(
  traces: ReadonlyArray<XesTraceSummary>,
  log: Pm4jsEventLog,
  statsApi: Pm4jsGeneralLogStatistics | undefined
): { startCounts: Record<string, number>; endCounts: Record<string, number> } {
  const startCounts: Record<string, number> = statsApi?.getStartActivities
    ? { ...statsApi.getStartActivities(log, XES_CONCEPT_NAME) }
    : {};
  const endCounts: Record<string, number> = statsApi?.getEndActivities
    ? { ...statsApi.getEndActivities(log, XES_CONCEPT_NAME) }
    : {};

  if (Object.keys(startCounts).length > 0 && Object.keys(endCounts).length > 0) {
    return { startCounts, endCounts };
  }

  for (const trace of traces) {
    if (trace.activities.length === 0) {
      continue;
    }
    const start = trace.activities[0];
    const end = trace.activities[trace.activities.length - 1];
    startCounts[start] = (startCounts[start] || 0) + 1;
    endCounts[end] = (endCounts[end] || 0) + 1;
  }
  return { startCounts, endCounts };
}

function pathPreview(activities: ReadonlyArray<string>, limit = 4): string {
  if (activities.length <= limit) {
    return activities.join(' → ') || '(empty)';
  }
  return `${activities.slice(0, limit).join(' → ')} …`;
}

function buildVariantPareto(
  variants: ReadonlyArray<XesActivityCount>,
  totalCases: number
): XesVariantCoverage[] {
  let cumulative = 0;
  return variants.map((variant) => {
    const share = totalCases > 0 ? (variant.count / totalCases) * 100 : 0;
    cumulative += share;
    return {
      name: variant.name,
      count: variant.count,
      share,
      cumulativeShare: Math.min(100, Math.round(cumulative * 10) / 10)
    };
  });
}

function buildCaseHighlights(
  traces: ReadonlyArray<XesTraceSummary>
): { longestCases: XesCaseHighlight[]; busiestCases: XesCaseHighlight[] } {
  const toHighlight = (trace: XesTraceSummary): XesCaseHighlight => ({
    caseId: trace.caseId,
    eventCount: trace.eventCount,
    durationLabel: trace.durationLabel,
    pathPreview: pathPreview(trace.activities)
  });

  const longestCases = [...traces]
    .filter((trace) => trace.durationMs !== null)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, XES_TOP_CASE_HIGHLIGHTS)
    .map(toHighlight);

  const busiestCases = [...traces]
    .sort((a, b) => b.eventCount - a.eventCount || a.caseId.localeCompare(b.caseId))
    .slice(0, XES_TOP_CASE_HIGHLIGHTS)
    .map(toHighlight);

  return { longestCases, busiestCases };
}

function buildTemporalBuckets(rows: ReadonlyArray<XesEventRow>): {
  hourlyBuckets: XesDistributionBucket[];
  weekdayBuckets: XesDistributionBucket[];
} {
  const hourCounts = Array.from({ length: 24 }, () => 0);
  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  let stamped = 0;
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (const row of rows) {
    if (row.timestampMs === null) {
      continue;
    }
    const date = new Date(row.timestampMs);
    hourCounts[date.getHours()] += 1;
    weekdayCounts[date.getDay()] += 1;
    stamped += 1;
  }

  const hourlyBuckets = hourCounts
    .map((count, hour) => ({
      label: `${String(hour).padStart(2, '0')}:00`,
      count,
      share: stamped > 0 ? (count / stamped) * 100 : 0
    }))
    .filter((bucket) => bucket.count > 0);

  const weekdayBuckets = weekdayCounts
    .map((count, day) => ({
      label: weekdayLabels[day],
      count,
      share: stamped > 0 ? (count / stamped) * 100 : 0
    }))
    .filter((bucket) => bucket.count > 0);

  return { hourlyBuckets, weekdayBuckets };
}

function buildReworkAndLoops(traces: ReadonlyArray<XesTraceSummary>): {
  reworkActivities: Record<string, number>;
  selfLoops: Record<string, number>;
  reworkCases: number;
  selfLoopCount: number;
} {
  const reworkActivities: Record<string, number> = {};
  const selfLoops: Record<string, number> = {};
  let reworkCases = 0;
  let selfLoopCount = 0;

  for (const trace of traces) {
    const seen = new Map<string, number>();
    let caseHasRework = false;
    for (let index = 0; index < trace.activities.length; index += 1) {
      const activity = trace.activities[index];
      seen.set(activity, (seen.get(activity) || 0) + 1);
      if (index > 0 && trace.activities[index - 1] === activity) {
        selfLoops[activity] = (selfLoops[activity] || 0) + 1;
        selfLoopCount += 1;
      }
    }
    for (const [activity, count] of seen.entries()) {
      if (count > 1) {
        caseHasRework = true;
        reworkActivities[activity] = (reworkActivities[activity] || 0) + 1;
      }
    }
    if (caseHasRework) {
      reworkCases += 1;
    }
  }

  return { reworkActivities, selfLoops, reworkCases, selfLoopCount };
}

function buildInsightFindings(options: {
  traces: number;
  events: number;
  variantCoverage: number;
  reworkCaseShare: number;
  selfLoopCount: number;
  startActivities: XesRankedCount[];
  endActivities: XesRankedCount[];
  transitions: XesRankedCount[];
  variantPareto: XesVariantCoverage[];
  avgEventsPerCase: number;
  avgDurationLabel: string;
}): string[] {
  const findings: string[] = [];
  findings.push(
    `${options.traces} cases and ${options.events} events average ${options.avgEventsPerCase} steps over ${options.avgDurationLabel}.`
  );

  if (options.startActivities[0]) {
    findings.push(
      `Most cases start with “${options.startActivities[0].name}” (${options.startActivities[0].share.toFixed(1)}%).`
    );
  }
  if (options.endActivities[0]) {
    findings.push(
      `Most cases end with “${options.endActivities[0].name}” (${options.endActivities[0].share.toFixed(1)}%).`
    );
  }
  if (options.transitions[0]) {
    findings.push(
      `Strongest handoff is ${options.transitions[0].name} (${options.transitions[0].count} times).`
    );
  }
  if (options.variantPareto[0]) {
    const top3 = options.variantPareto[Math.min(2, options.variantPareto.length - 1)];
    findings.push(
      `Top path covers ${options.variantPareto[0].share.toFixed(1)}% of cases` +
        (top3 ? `; top 3 reach ${top3.cumulativeShare.toFixed(1)}%` : '') +
        '.'
    );
  }
  if (options.reworkCaseShare > 0) {
    findings.push(
      `${options.reworkCaseShare}% of cases repeat at least one activity (rework signal).`
    );
  }
  if (options.selfLoopCount > 0) {
    findings.push(`${options.selfLoopCount} self-loop transitions detected (A → A).`);
  }
  findings.push(`Path diversity is ${options.variantCoverage}% (variants ÷ cases).`);
  return findings.slice(0, 7);
}

/** Builds start/end, resource, transition and distribution analytics for Insights. */
export function buildXesLogInsights(
  log: Pm4jsEventLog,
  rows: ReadonlyArray<XesEventRow>,
  traces: ReadonlyArray<XesTraceSummary>,
  variants: ReadonlyArray<XesActivityCount>,
  statsApi: Pm4jsGeneralLogStatistics | undefined = getPm4jsStatistics()
): XesLogInsights {
  const eventCounts = traces.map((trace) => trace.eventCount).sort((a, b) => a - b);
  const durations = traces
    .map((trace) => trace.durationMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  const avgEvents =
    eventCounts.length > 0
      ? eventCounts.reduce((sum, value) => sum + value, 0) / eventCounts.length
      : 0;
  const avgDurationMs =
    durations.length > 0
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : 0;

  const { startCounts, endCounts } = collectEndpointCounts(traces, log, statsApi);

  const resourceCounts: Record<string, number> = {};
  const lifecycleCounts: Record<string, number> = {};
  for (const row of rows) {
    if (row.resource && row.resource !== '—') {
      resourceCounts[row.resource] = (resourceCounts[row.resource] || 0) + 1;
    }
    if (row.lifecycle && row.lifecycle !== '—') {
      lifecycleCounts[row.lifecycle] = (lifecycleCounts[row.lifecycle] || 0) + 1;
    }
  }

  const transitionCounts: Record<string, number> = {};
  for (const trace of traces) {
    for (let index = 0; index < trace.activities.length - 1; index += 1) {
      const key = `${trace.activities[index]} → ${trace.activities[index + 1]}`;
      transitionCounts[key] = (transitionCounts[key] || 0) + 1;
    }
  }
  const transitionTotal = Object.values(transitionCounts).reduce((sum, value) => sum + value, 0);
  const transitions = toRankedCounts(transitionCounts, transitionTotal, XES_TOP_INSIGHT_ITEMS);

  const { reworkActivities, selfLoops, reworkCases, selfLoopCount } = buildReworkAndLoops(traces);
  const reworkCaseShare =
    traces.length > 0 ? Math.round((reworkCases / traces.length) * 1000) / 10 : 0;

  const stamped = rows.filter((row) => row.timestampMs !== null);
  let eventsPerDayLabel = '—';
  if (stamped.length > 1) {
    const times = stamped.map((row) => row.timestampMs as number);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const days = Math.max(1, (max - min) / (24 * 60 * 60 * 1000));
    eventsPerDayLabel = `${Math.round((stamped.length / days) * 10) / 10} events/day`;
  }

  const variantCoverage =
    traces.length > 0 ? Math.round((variants.length / traces.length) * 1000) / 10 : 0;
  const startActivities = toRankedCounts(startCounts, traces.length, XES_TOP_INSIGHT_ITEMS);
  const endActivities = toRankedCounts(endCounts, traces.length, XES_TOP_INSIGHT_ITEMS);
  const variantPareto = buildVariantPareto(variants, traces.length);
  const { longestCases, busiestCases } = buildCaseHighlights(traces);
  const { hourlyBuckets, weekdayBuckets } = buildTemporalBuckets(rows);

  const avgEventsPerCase = Math.round(avgEvents * 10) / 10;
  const avgDurationLabel = durations.length > 0 ? formatXesDuration(0, avgDurationMs) : '—';

  return {
    avgEventsPerCase,
    medianEventsPerCase: medianOfSorted(eventCounts),
    minEventsPerCase: eventCounts.length > 0 ? eventCounts[0] : 0,
    maxEventsPerCase: eventCounts.length > 0 ? eventCounts[eventCounts.length - 1] : 0,
    avgDurationLabel,
    medianDurationLabel:
      durations.length > 0 ? formatXesDuration(0, medianOfSorted(durations)) : '—',
    variantCoverage,
    selfLoopCount,
    reworkCaseShare,
    eventsPerDayLabel,
    findings: buildInsightFindings({
      traces: traces.length,
      events: rows.length,
      variantCoverage,
      reworkCaseShare,
      selfLoopCount,
      startActivities,
      endActivities,
      transitions,
      variantPareto,
      avgEventsPerCase,
      avgDurationLabel
    }),
    startActivities,
    endActivities,
    resources: toRankedCounts(resourceCounts, rows.length, XES_TOP_INSIGHT_ITEMS),
    transitions,
    lifecycleCounts: toRankedCounts(lifecycleCounts, rows.length, XES_TOP_INSIGHT_ITEMS),
    reworkActivities: toRankedCounts(reworkActivities, traces.length, XES_TOP_INSIGHT_ITEMS),
    selfLoops: toRankedCounts(selfLoops, Math.max(selfLoopCount, 1), XES_TOP_INSIGHT_ITEMS),
    caseLengthBuckets: bucketCounts(
      eventCounts,
      [
        { max: 5, label: '1–5 events' },
        { max: 15, label: '6–15 events' },
        { max: 40, label: '16–40 events' },
        { max: 100, label: '41–100 events' }
      ],
      '100+ events'
    ),
    durationBuckets: bucketCounts(
      durations.map((ms) => ms / 60_000),
      [
        { max: 5, label: '≤ 5 min' },
        { max: 30, label: '5–30 min' },
        { max: 120, label: '30 min–2 h' },
        { max: 480, label: '2–8 h' }
      ],
      '8 h+'
    ),
    hourlyBuckets,
    weekdayBuckets,
    variantPareto: variantPareto.slice(0, XES_TOP_INSIGHT_ITEMS),
    longestCases,
    busiestCases
  };
}

export function resolveXesSuggestion(options: {
  hasFiles: boolean;
  hasError: boolean;
  eventCount: number;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'xes-meta',
      title: 'Check the file type?',
      reason:
        'Parsing failed or the format was rejected. Confirm it is a valid XES/XML event log.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!options.hasFiles) {
    return {
      id: 'xes-intro',
      title: 'Have a CSV event export instead?',
      reason: 'Many process-mining tools export CSV. Preview tabular logs in Excel Viewer.',
      actionLabel: 'Open Excel Viewer',
      path: '/file-viewers/excel-viewer'
    };
  }

  if (options.eventCount > 5000) {
    return {
      id: 'xes-large',
      title: 'Working with a large log?',
      reason: 'Filter by case or activity first, then export the filtered rows.',
      actionLabel: 'Open Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }

  return {
    id: 'xes-log',
    title: 'Compare with plain-text logs?',
    reason: 'Application .log files use a different layout — open them in Log Viewer.',
    actionLabel: 'Open Log Viewer',
    path: '/file-viewers/log-viewer'
  };
}
