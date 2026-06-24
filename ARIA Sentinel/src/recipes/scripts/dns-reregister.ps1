# ARIA Sentinel recipe: dns-fail-v1 / register-dns + restart-dnscache  (R-02 NET.DNS.FAIL, fuller)
# Reversible green. Completes the R-02 recipe beyond the original `ipconfig /flushdns`: re-registers
# the client's DNS records and restarts the DNS Client (Dnscache) service, which rebuilds on the
# next lookup. flush-dns.ps1 remains the mirror for the first action; this file mirrors the two
# follow-on actions. Both commands are executed inline via -Command under -ExecutionPolicy Restricted.
ipconfig /registerdns
Restart-Service Dnscache -Force
