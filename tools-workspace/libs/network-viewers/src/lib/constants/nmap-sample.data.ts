/** Synthetic Nmap XML scan (education / research). */

export const NMAP_XML_SAMPLE = `<?xml version="1.0"?>
<nmaprun scanner="nmap" args="nmap -sV -sU --top-ports 20 10.0.0.0/24" start="1741763641" version="7.94">
  <host>
    <status state="up" reason="echo-reply"/>
    <address addr="10.0.0.5" addrtype="ipv4"/>
    <hostnames><hostname name="gw-01.lab" type="PTR"/></hostnames>
    <ports>
      <port protocol="tcp" portid="22"><state state="open"/><service name="ssh" product="OpenSSH" version="8.9"/></port>
      <port protocol="tcp" portid="80"><state state="open"/><service name="http" product="nginx" version="1.22"/></port>
      <port protocol="tcp" portid="443"><state state="open"/><service name="https" product="nginx" version="1.22"/></port>
      <port protocol="tcp" portid="445"><state state="filtered"/><service name="microsoft-ds"/></port>
    </ports>
    <os><osmatch name="Linux 5.15" accuracy="95"/></os>
  </host>
  <host>
    <status state="up"/>
    <address addr="10.0.0.21" addrtype="ipv4"/>
    <hostnames><hostname name="laptop-21.lab"/></hostnames>
    <ports>
      <port protocol="tcp" portid="22"><state state="closed"/><service name="ssh"/></port>
      <port protocol="tcp" portid="8080"><state state="open"/><service name="http-proxy" product="Werkzeug" version="2.3"/></port>
    </ports>
  </host>
  <host>
    <status state="up"/>
    <address addr="10.0.0.8" addrtype="ipv4"/>
    <hostnames><hostname name="dc-01.lab"/></hostnames>
    <ports>
      <port protocol="tcp" portid="88"><state state="open"/><service name="kerberos-sec"/></port>
      <port protocol="tcp" portid="135"><state state="open"/><service name="msrpc"/></port>
      <port protocol="udp" portid="53"><state state="open"/><service name="domain" product="BIND" version="9.18"/></port>
      <port protocol="tcp" portid="389"><state state="open"/><service name="ldap"/></port>
    </ports>
    <os><osmatch name="Windows Server 2022" accuracy="90"/></os>
  </host>
</nmaprun>
`;

export const NMAP_GNMAP_SAMPLE = `# Nmap 7.94 scan initiated
Host: 10.0.0.5 (gw-01.lab) Status: Up
Host: 10.0.0.5 (gw-01.lab) Ports: 22/open/tcp//ssh//OpenSSH 8.9/, 80/open/tcp//http//nginx 1.22/
`;

export const NMAP_CSV_SAMPLE = `ip,hostname,port,protocol,state,service
10.0.0.5,gw-01.lab,22,tcp,open,ssh
10.0.0.5,gw-01.lab,80,tcp,open,http
10.0.0.21,laptop-21.lab,8080,tcp,open,http-proxy
`;
