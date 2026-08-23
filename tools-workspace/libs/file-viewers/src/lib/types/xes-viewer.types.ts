/** Minimal PM4JS event-log shapes used by the XES viewer. */
export interface Pm4jsAttribute {
  value: unknown;
  attributes?: unknown;
}

export interface Pm4jsEvent {
  attributes: Record<string, Pm4jsAttribute>;
}

export interface Pm4jsTrace {
  attributes: Record<string, Pm4jsAttribute>;
  events: Pm4jsEvent[];
}

export interface Pm4jsEventLog {
  attributes: Record<string, Pm4jsAttribute>;
  traces: Pm4jsTrace[];
  extensions: Record<string, [string, string]>;
  globals: Record<string, { attributes: Record<string, Pm4jsAttribute> }>;
  classifiers: Record<string, string>;
}

export interface Pm4jsXesImporter {
  apply(xmlString: string): Pm4jsEventLog;
}

export interface Pm4jsGeneralLogStatistics {
  numEvents(log: Pm4jsEventLog): number;
  getVariants(log: Pm4jsEventLog, activityKey?: string): Record<string, number>;
  getAttributeValues(log: Pm4jsEventLog, attributeKey: string): Record<string, number>;
  getStartActivities(log: Pm4jsEventLog, activityKey?: string): Record<string, number>;
  getEndActivities(log: Pm4jsEventLog, activityKey?: string): Record<string, number>;
}

export interface Pm4jsGeneralLogStatisticsExtras {
  getEventAttributesList(log: Pm4jsEventLog): string[];
  getCaseAttributesList(log: Pm4jsEventLog): string[];
}

export interface Pm4jsApi {
  XesImporter: Pm4jsXesImporter;
  GeneralLogStatistics?: Pm4jsGeneralLogStatistics;
}

export interface XesKeyValue {
  key: string;
  value: string;
}

export interface XesExtensionInfo {
  name: string;
  prefix: string;
  uri: string;
}

export interface XesClassifierInfo {
  name: string;
  keys: string;
}

export interface XesGlobalScopeInfo {
  scope: string;
  attributes: XesKeyValue[];
}

/** Everything the XES header declares about the log itself. */
export interface XesLogMetadata {
  name: string;
  attributes: XesKeyValue[];
  extensions: XesExtensionInfo[];
  classifiers: XesClassifierInfo[];
  globals: XesGlobalScopeInfo[];
  eventAttributeKeys: string[];
  traceAttributeKeys: string[];
}

export interface XesLoadedFile {
  name: string;
  file: File;
  size: number;
  log: Pm4jsEventLog;
  /** Original uploaded text — used for “Download original XES”. */
  sourceText: string;
  loaded: boolean;
}

export interface XesEventRow {
  id: string;
  caseId: string;
  activity: string;
  timestamp: string;
  timestampMs: number | null;
  resource: string;
  lifecycle: string;
  traceIndex: number;
  eventIndex: number;
  attributes: XesKeyValue[];
}

export interface XesTraceSummary {
  index: number;
  caseId: string;
  eventCount: number;
  startTime: string;
  endTime: string;
  durationLabel: string;
  durationMs: number | null;
  activities: string[];
  attributes: XesKeyValue[];
}

export interface XesLogStats {
  cases: number;
  events: number;
  activities: number;
  variants: number;
  resources: number;
  startActivities: number;
  endActivities: number;
  timeSpanLabel: string;
}

export interface XesActivityCount {
  name: string;
  count: number;
}

/** Named count with relative share for charts and ranked lists. */
export interface XesRankedCount {
  name: string;
  count: number;
  share: number;
}

export interface XesDistributionBucket {
  label: string;
  count: number;
  share: number;
}

export interface XesVariantCoverage {
  name: string;
  count: number;
  share: number;
  cumulativeShare: number;
}

export interface XesCaseHighlight {
  caseId: string;
  eventCount: number;
  durationLabel: string;
  pathPreview: string;
}

/** Derived analytics used by the Insights view and summary export. */
export interface XesLogInsights {
  avgEventsPerCase: number;
  medianEventsPerCase: number;
  minEventsPerCase: number;
  maxEventsPerCase: number;
  avgDurationLabel: string;
  medianDurationLabel: string;
  variantCoverage: number;
  selfLoopCount: number;
  reworkCaseShare: number;
  eventsPerDayLabel: string;
  findings: string[];
  startActivities: XesRankedCount[];
  endActivities: XesRankedCount[];
  resources: XesRankedCount[];
  transitions: XesRankedCount[];
  lifecycleCounts: XesRankedCount[];
  reworkActivities: XesRankedCount[];
  selfLoops: XesRankedCount[];
  caseLengthBuckets: XesDistributionBucket[];
  durationBuckets: XesDistributionBucket[];
  hourlyBuckets: XesDistributionBucket[];
  weekdayBuckets: XesDistributionBucket[];
  variantPareto: XesVariantCoverage[];
  longestCases: XesCaseHighlight[];
  busiestCases: XesCaseHighlight[];
}

export type XesViewMode =
  | 'insights'
  | 'events'
  | 'traces'
  | 'activities'
  | 'variants'
  | 'log';

export type XesExportGroup = 'events' | 'cases' | 'analytics' | 'source';

export type XesExportFormat =
  | 'events-csv'
  | 'events-tsv'
  | 'events-json'
  | 'timeline-csv'
  | 'cases-csv'
  | 'cases-json'
  | 'activities-csv'
  | 'variants-csv'
  | 'transitions-csv'
  | 'resources-csv'
  | 'start-end-csv'
  | 'dfg-dot'
  | 'summary-json'
  | 'markdown-report'
  | 'full-report-csv'
  | 'full-report-pdf'
  | 'original-xes';

export interface XesExportOption {
  id: XesExportFormat;
  label: string;
  description: string;
  extension: string;
  group: XesExportGroup;
}

/** Shared payload for full analysis report exports (PDF / CSV / Markdown). */
export interface XesReportPayload {
  fileName: string;
  stats: XesLogStats | null;
  metadata: XesLogMetadata | null;
  insights: XesLogInsights | null;
  activities: ReadonlyArray<XesActivityCount>;
  variants: ReadonlyArray<XesActivityCount>;
}
