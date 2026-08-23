/** Synthetic Nessus report (education / research). */

export const NESSUS_XML_SAMPLE = `<?xml version="1.0"?>
<NessusClientData_v2>
  <Report name="Lab weekly scan">
    <ReportHost name="gw-01.lab">
      <HostProperties>
        <tag name="host-ip">10.0.0.5</tag>
        <tag name="operating-system">Linux 5.15</tag>
      </HostProperties>
      <ReportItem port="22" svc_name="ssh" protocol="tcp" severity="2" pluginID="70658" pluginName="SSH Weak MAC Algorithms">
        <synopsis>The remote SSH server supports weak MAC algorithms.</synopsis>
        <solution>Disable weak MACs in sshd_config.</solution>
        <cvss_base_score>5.0</cvss_base_score>
        <cve>CVE-2008-5161</cve>
      </ReportItem>
      <ReportItem port="80" svc_name="http" protocol="tcp" severity="3" pluginID="34460" pluginName="nginx Outdated Version">
        <synopsis>The installed nginx version is no longer supported.</synopsis>
        <solution>Upgrade nginx to a supported release.</solution>
        <cvss_base_score>7.5</cvss_base_score>
        <cve>CVE-2023-44487</cve>
      </ReportItem>
      <ReportItem port="443" svc_name="https" protocol="tcp" severity="2" pluginID="104743" pluginName="TLS Version 1.0 Protocol Detection">
        <synopsis>The remote service accepts TLS 1.0.</synopsis>
        <solution>Disable TLS 1.0 and require TLS 1.2+.</solution>
        <cvss_base_score>4.3</cvss_base_score>
      </ReportItem>
    </ReportHost>
    <ReportHost name="laptop-21.lab">
      <HostProperties>
        <tag name="host-ip">10.0.0.21</tag>
      </HostProperties>
      <ReportItem port="8080" svc_name="www" protocol="tcp" severity="4" pluginID="97833" pluginName="Unauthenticated Admin Interface">
        <synopsis>An administrative web UI is exposed without authentication.</synopsis>
        <solution>Restrict access and require authentication.</solution>
        <cvss_base_score>9.8</cvss_base_score>
        <cve>CVE-2024-21626</cve>
      </ReportItem>
    </ReportHost>
    <ReportHost name="dc-01.lab">
      <HostProperties>
        <tag name="host-ip">10.0.0.8</tag>
        <tag name="operating-system">Windows Server 2022</tag>
      </HostProperties>
      <ReportItem port="389" svc_name="ldap" protocol="tcp" severity="3" pluginID="57581" pluginName="LDAP Signing Not Required">
        <synopsis>LDAP signing is not required on the domain controller.</synopsis>
        <solution>Enable LDAP signing and channel binding.</solution>
        <cvss_base_score>7.1</cvss_base_score>
      </ReportItem>
      <ReportItem port="0" svc_name="icmp" protocol="icmp" severity="0" pluginID="10114" pluginName="ICMP Timestamp Request Remote Date Disclosure">
        <synopsis>The remote host answers to ICMP timestamp requests.</synopsis>
        <solution>Filter ICMP timestamp requests at the firewall.</solution>
        <cvss_base_score>0.0</cvss_base_score>
      </ReportItem>
    </ReportHost>
  </Report>
</NessusClientData_v2>
`;

export const NESSUS_CSV_SAMPLE = `host,ip,port,protocol,severity,plugin_id,plugin_name,cvss,cve,synopsis
gw-01.lab,10.0.0.5,22,tcp,medium,70658,SSH Weak MAC Algorithms,5.0,CVE-2008-5161,Weak SSH MACs
laptop-21.lab,10.0.0.21,8080,tcp,critical,97833,Unauthenticated Admin Interface,9.8,CVE-2024-21626,Open admin UI
dc-01.lab,10.0.0.8,389,tcp,high,57581,LDAP Signing Not Required,7.1,,LDAP signing off
`;
