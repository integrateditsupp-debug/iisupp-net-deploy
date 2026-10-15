# ARIA Sentinel recipe: dns-fail-v1 / register-dns + clear-dns-client-cache  (R-02 NET.DNS.FAIL, fuller)
# Reversible green. Completes the R-02 recipe beyond the original `ipconfig /flushdns`: re-registers
# the client's DNS records and clears the DNS Client resolver cache in user space. flush-dns.ps1 remains
# the mirror for the first action; this file mirrors the two follow-on actions. Both commands are executed
# inline via -Command under -ExecutionPolicy Restricted and need NO administrator rights.
# PROD 2026-10-14 (audit M3): `Restart-Service Dnscache -Force` was removed — the DNS Client service cannot
# be stopped or restarted by anyone (not even an administrator) on Windows 10 1809+ / Windows 11, so that
# step failed every time and turned the whole recipe red.
ipconfig /registerdns
Clear-DnsClientCache
