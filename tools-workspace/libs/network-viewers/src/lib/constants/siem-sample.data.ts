/** Synthetic SIEM export (education / research). */

export function buildSiemSampleObject(): Record<string, unknown> {
  return {
    name: 'SOC morning export',
    source: 'Synthetic education sample',
    events: [
      {
        time: '2026-03-12T09:14:02Z',
        severity: 'high',
        rule: 'Brute force SSH',
        ruleId: 'SIEM-1042',
        host: 'gw-01',
        user: 'root',
        src: '203.0.113.10',
        dst: '10.0.0.5',
        tactic: 'Credential Access',
        technique: 'T1110',
        message: '10 failed SSH logins in 60s',
        count: 10
      },
      {
        time: '2026-03-12T09:14:08Z',
        severity: 'high',
        rule: 'Brute force SSH',
        ruleId: 'SIEM-1042',
        host: 'gw-01',
        user: 'admin',
        src: '203.0.113.10',
        dst: '10.0.0.5',
        tactic: 'Credential Access',
        technique: 'T1110',
        message: 'Additional SSH failures from same source',
        count: 6
      },
      {
        time: '2026-03-12T09:15:20Z',
        severity: 'critical',
        rule: 'Possible malware beacon',
        ruleId: 'SIEM-2201',
        host: 'laptop-21',
        user: 'ada',
        src: '10.0.0.21',
        dst: '198.51.100.80',
        tactic: 'Command and Control',
        technique: 'T1071',
        message: 'Periodic HTTPS to rare ASN',
        count: 12
      },
      {
        time: '2026-03-12T09:15:44Z',
        severity: 'medium',
        rule: 'Suspicious SMB probe',
        ruleId: 'SIEM-0911',
        host: 'gw-01',
        user: '-',
        src: '203.0.113.88',
        dst: '10.0.0.5',
        tactic: 'Lateral Movement',
        technique: 'T1021.002',
        message: 'Inbound SMB (445) blocked by firewall',
        count: 3
      },
      {
        time: '2026-03-12T09:16:10Z',
        severity: 'low',
        rule: 'New local admin',
        ruleId: 'SIEM-0310',
        host: 'dc-01',
        user: 'helpdesk',
        src: '10.0.0.8',
        dst: '10.0.0.2',
        tactic: 'Persistence',
        technique: 'T1098',
        message: 'User added to Administrators',
        count: 1
      },
      {
        time: '2026-03-12T09:16:40Z',
        severity: 'info',
        rule: 'VPN login success',
        ruleId: 'SIEM-0101',
        host: 'vpn-01',
        user: 'ada',
        src: '198.51.100.20',
        dst: '10.0.0.1',
        tactic: 'Initial Access',
        technique: 'T1133',
        message: 'Successful MFA VPN session',
        count: 1
      },
      {
        time: '2026-03-12T09:17:05Z',
        severity: 'critical',
        rule: 'Possible malware beacon',
        ruleId: 'SIEM-2201',
        host: 'laptop-21',
        user: 'ada',
        src: '10.0.0.21',
        dst: '198.51.100.80',
        tactic: 'Command and Control',
        technique: 'T1071',
        message: 'Beacon interval continued',
        count: 8
      },
      {
        time: '2026-03-12T09:18:12Z',
        severity: 'medium',
        rule: 'DNS to newly registered domain',
        ruleId: 'SIEM-1504',
        host: 'laptop-34',
        user: 'sam',
        src: '10.0.0.34',
        dst: '8.8.8.8',
        tactic: 'Command and Control',
        technique: 'T1071.004',
        message: 'Query for suspicious.example',
        count: 2
      }
    ]
  };
}

export const SIEM_JSON_SAMPLE = JSON.stringify(buildSiemSampleObject(), null, 2);

export const SIEM_CEF_SAMPLE = `CEF:0|EasyToolHub|SampleSIEM|1.0|1042|Brute force SSH|8|src=203.0.113.10 dst=10.0.0.5 suser=root dhost=gw-01
CEF:0|EasyToolHub|SampleSIEM|1.0|2201|Possible malware beacon|10|src=10.0.0.21 dst=198.51.100.80 suser=ada dhost=laptop-21
CEF:0|EasyToolHub|SampleSIEM|1.0|0101|VPN login success|3|src=198.51.100.20 dst=10.0.0.1 suser=ada dhost=vpn-01
`;
