import type { SarifRelatedToolLink } from '../types/sarif-report-viewer.types';

export const SARIF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.sarif', '.json', '.csv'];

export const SARIF_ACCEPT_ATTR = '.sarif,.json,.csv,application/sarif+json,application/json,text/csv,text/plain';

export const SARIF_FORMATS_LABEL = '.sarif, .json, .csv';

export const SARIF_FORMATS_HINT =
  'Static analysis findings with rules and file locations. Education/research only.';

export const SARIF_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SARIF_RELATED_TOOLS: ReadonlyArray<SarifRelatedToolLink> = [
  { label: 'Nessus Report Viewer', description: 'Findings and severity', path: '/network-viewers/nessus-report-viewer' },
  { label: 'Malware Analysis Report Viewer', description: 'IOC and behavior', path: '/network-viewers/malware-analysis-report-viewer' },
  { label: 'SIEM Log Viewer', description: 'Correlate security events', path: '/network-viewers/siem-log-viewer' },
  { label: 'Threat Intelligence Viewer', description: 'Indicators and relationships', path: '/network-viewers/threat-intelligence-viewer' }
];
