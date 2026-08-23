/** Synthetic syslog dump (education / research). */

export const SYSLOG_LOG_SAMPLE = `# SYSLOG Edge gateway
<34>Mar 12 09:14:01 gw sshd[2210]: Failed password for root from 203.0.113.10 port 54321 ssh2
<86>Mar 12 09:14:02 gw systemd[1]: Started Session 12 of user ada.
<30>Mar 12 09:14:08 gw kernel: [UFW BLOCK] IN=eth0 SRC=203.0.113.10 DST=10.0.0.5 DPT=22
<29>Mar 12 09:14:12 gw cron[88]: (root) CMD (/usr/sbin/logrotate)
<27>Mar 12 09:15:20 gw named[90]: client 10.0.0.21#53001: query: example.com IN A
<11>Mar 12 09:15:44 mail postfix/smtpd[410]: connect from unknown[198.51.100.8]
<165>1 2026-03-12T09:16:10.000Z dc-01 sudo 512 - - ada : COMMAND=/usr/bin/id
<14>Mar 12 09:16:40 vpn openvpn[88]: peer connection initiated with [198.51.100.20]:1194
<3>Mar 12 09:17:05 gw kernel: Out of memory: Kill process 991 (build)
<28>Mar 12 09:18:12 gw systemd[1]: Reloading.
`;

export const SYSLOG_CSV_SAMPLE = `time,facility,severity,host,app,message
2026-03-12T09:14:01Z,auth,crit,gw,sshd,Failed password for root
2026-03-12T09:14:02Z,authpriv,info,gw,systemd,Started Session 12 of user ada
2026-03-12T09:15:20Z,daemon,err,gw,named,client query example.com IN A
`;
