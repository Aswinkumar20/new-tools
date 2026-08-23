/** Synthetic DNS resolver log (education / research). */

export const DNS_LOG_SAMPLE = `# DNS Edge resolver
12-Mar-2026 09:14:01.010 queries: info: client @0x7f 10.0.0.21#53001 (example.com): query: example.com IN A +E (10.0.0.53)
12-Mar-2026 09:14:01.022 queries: info: client @0x7f 10.0.0.21#53002 (example.com): query: example.com IN AAAA +E (10.0.0.53)
Mar 12 09:14:01 dnsmasq[412]: query[A] google.com from 10.0.0.34
Mar 12 09:14:01 dnsmasq[412]: reply google.com is 142.250.190.78
Mar 12 09:14:02 dnsmasq[412]: query[MX] corp.internal from 10.0.0.8
Mar 12 09:14:02 dnsmasq[412]: reply corp.internal is NXDOMAIN
Mar 12 09:14:08 dnsmasq[412]: query[TXT] _dmarc.example.com from 10.0.0.21
Mar 12 09:14:08 dnsmasq[412]: reply _dmarc.example.com is "v=DMARC1; p=none"
Mar 12 09:14:12 dnsmasq[412]: query[PTR] 53.0.0.10.in-addr.arpa from 10.0.0.5
Mar 12 09:14:18 client 10.0.0.34#53110 (suspicious.example): query: suspicious.example IN A +
`;

export const DNS_CSV_SAMPLE = `time,client,qname,qtype,rcode,answer
2026-03-12T09:14:01Z,10.0.0.21,example.com,A,NOERROR,93.184.216.34
2026-03-12T09:14:02Z,10.0.0.8,corp.internal,MX,NXDOMAIN,
2026-03-12T09:14:08Z,10.0.0.21,_dmarc.example.com,TXT,NOERROR,"v=DMARC1; p=none"
`;
