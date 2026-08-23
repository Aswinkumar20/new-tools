import type { ThreatRelatedToolLink } from '../types/threat-intelligence-viewer.types';

export const THREAT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.xml', '.csv', '.txt'];

export const THREAT_ACCEPT_ATTR = '.json,.xml,.csv,.txt,application/json,application/stix+json,text/xml,application/xml,text/csv,text/plain';

export const THREAT_FORMATS_LABEL = '.json, .xml, .csv, .txt';

export const THREAT_FORMATS_HINT =
  'STIX 2.x threat intel with indicators and relationships. Education/research only.';

export const THREAT_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const THREAT_RELATED_TOOLS: ReadonlyArray<ThreatRelatedToolLink> = [
  { label: 'Malware Analysis Report Viewer', description: 'IOC and behavior', path: '/network-viewers/malware-analysis-report-viewer' },
  { label: 'SARIF Report Viewer', description: 'Static analysis results', path: '/network-viewers/sarif-report-viewer' },
  { label: 'SIEM Log Viewer', description: 'Correlate security events', path: '/network-viewers/siem-log-viewer' },
  { label: 'Nessus Report Viewer', description: 'Findings and severity', path: '/network-viewers/nessus-report-viewer' }
];
