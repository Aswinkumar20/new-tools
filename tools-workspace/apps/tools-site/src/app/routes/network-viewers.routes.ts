import { Routes } from '@angular/router';

export const NETWORK_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'har-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/har-viewer/har-viewer').then(m => m.HarViewerComponent),
  },
  {
    path: 'pcap-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/pcap-viewer/pcap-viewer').then(m => m.PcapViewerComponent),
  },
  {
    path: 'pcapng-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/pcapng-viewer/pcapng-viewer').then(m => m.PcapngViewerComponent),
  },
  {
    path: 'network-traffic-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/network-traffic-viewer/network-traffic-viewer').then(m => m.NetworkTrafficViewerComponent),
  },
  {
    path: 'packet-analyzer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/packet-analyzer/packet-analyzer').then(m => m.PacketAnalyzerComponent),
  },
  {
    path: 'protocol-analyzer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/protocol-analyzer/protocol-analyzer').then(m => m.ProtocolAnalyzerComponent),
  },
  {
    path: 'http-trace-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/http-trace-viewer/http-trace-viewer').then(m => m.HttpTraceViewerComponent),
  },
  {
    path: 'api-request-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/api-request-viewer/api-request-viewer').then(m => m.ApiRequestViewerComponent),
  },
  {
    path: 'firewall-log-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/firewall-log-viewer/firewall-log-viewer').then(m => m.FirewallLogViewerComponent),
  },
  {
    path: 'siem-log-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/siem-log-viewer/siem-log-viewer').then(m => m.SiemLogViewerComponent),
  },
  {
    path: 'syslog-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/syslog-viewer/syslog-viewer').then(m => m.SyslogViewerComponent),
  },
  {
    path: 'dns-log-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/dns-log-viewer/dns-log-viewer').then(m => m.DnsLogViewerComponent),
  },
  {
    path: 'nmap-report-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/nmap-report-viewer/nmap-report-viewer').then(m => m.NmapReportViewerComponent),
  },
  {
    path: 'nessus-report-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/nessus-report-viewer/nessus-report-viewer').then(m => m.NessusReportViewerComponent),
  },
  {
    path: 'sarif-report-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/sarif-report-viewer/sarif-report-viewer').then(m => m.SarifReportViewerComponent),
  },
  {
    path: 'malware-analysis-report-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/malware-analysis-report-viewer/malware-analysis-report-viewer').then(m => m.MalwareAnalysisReportViewerComponent),
  },
  {
    path: 'threat-intelligence-viewer',
    loadComponent: () =>
      import('@tools-workspace/network-viewers/threat-intelligence-viewer/threat-intelligence-viewer').then(m => m.ThreatIntelligenceViewerComponent),
  },
];
