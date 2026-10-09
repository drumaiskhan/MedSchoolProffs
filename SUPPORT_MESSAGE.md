# Message for cPanel host support (send this first)

Subject: Intermittent TCP/TLS connect timeouts to site.medschoolproffs.live:443 from one external server

Hello,

My Node app on Hostinger (outbound requests to https://site.medschoolproffs.live/dbbridge) intermittently fails to even establish the TCP/TLS connection to port 443 on my cPanel account (connect timeout, no HTTP response at all). The same URLs respond instantly from my PC (/dbbridge/health = 200, /dbbridge/db-health = ok), so the site and the database are healthy; the problem is specific to connections arriving from the Hostinger server.

Please check, for the time window I give you below:
1. Firewall / CSF / LFD: is the Hostinger source IP (I will send it) in any deny/temp-ban list (csf -g <ip>, /etc/csf/csf.deny, lfd.log)? Are CT_LIMIT / CT_INTERVAL / PORTFLOOD / SYNFLOOD / connection-rate limits for port 443 dropping bursts of new connections from one IP?
2. ModSecurity (WAF): any blocked/denied entries for that IP or for requests to /dbbridge (modsec_audit.log), and whether the custom header x-bridge-key or POST JSON bodies trigger rules.
3. Rate limiting / IP blocking: Imunify360, cPHulk, LiteSpeed/Apache per-IP limits, Cloudflare or other proxy rules in front of the site.
4. Inbound 443: any limits on concurrent connections per IP, and the Apache/LiteSpeed KeepAliveTimeout, MaxKeepAliveRequests and MaxRequestWorkers/ServerLimit (are workers ever exhausted?).
5. IPv6: does site.medschoolproffs.live have an AAAA record, and is IPv6 actually reachable and listening on 443 from outside? A broken IPv6 route makes some clients hang until timeout.
6. DNS: do A/AAAA records resolve consistently (all authoritative nameservers)?
7. Web server access/error logs: are the failing attempts ever logged? Please check whether any connection from the Hostinger IP arrives (tcpdump/netstat on port 443) during the failures, i.e. whether the SYN reaches the server at all.
8. Any difference in how traffic from the Hostinger IP range is routed (upstream DDoS protection / null-route / provider-level filtering).

Failure details from my app logs (UTC time, attempted address, error code) are attached below. Please reply with what you find in the firewall and web server logs for the Hostinger IP.

[paste 3-5 lines from the API log that start with "[db-bridge] connect-failed", and the output of https://api.medschoolproffs.live/api/bridge-health]
[Hostinger outbound IP: ...]
