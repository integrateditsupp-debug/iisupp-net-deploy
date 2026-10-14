// network-watcher — fires NET.ADAPTER.DOWN / NET.DNS.FAIL / NET.DOWN.
// Sources: Get-NetAdapter (operational status) + a DNS probe + a reachability probe · cadence 120s.
// Content-blind: adapter names, MACs, IPs, the gateway and the DNS server address are read locally and DROPPED.
// Only the booleans "any adapter up", "dns resolves" and "gateway reachable" are evaluated.
//
// PROD 2026-10-14 (audit M8) — QUIET AND LOCAL. This watcher used to spawn PowerShell TWICE every 30 s (4/min)
// and probe third-party hosts (Resolve-DnsName microsoft.com + Test-NetConnection 1.1.1.1:53) — outbound traffic
// no verifier saw and corporate firewalls flag. Now ONE spawn every 120 s probes the machine's OWN network edge:
//   · reachability = ICMP to the default gateway (or TCP/53 to the configured DNS server when there is no route);
//   · DNS = resolve the name Windows' own connectivity sensor (NCSI) already resolves, through the configured
//     resolver — no new traffic signature;
// Both targets are configurable (watcherOptions.network.{probeHost,dnsProbeName}) for sites that prefer a
// public anchor; the values are validated to a host/IP shape before they are ever placed in the command.
import { runPowerShellJson, toArray } from "./ps.mjs";

export const NETWORK_CADENCE_MS = 120 * 1000;
export const DEFAULT_DNS_PROBE_NAME = "dns.msftncsi.com"; // the NCSI name Windows itself resolves

const HOST_RE = /^[A-Za-z0-9.-]{1,253}$/;
const IP_RE = /^[0-9A-Fa-f.:]{3,45}$/;

/** Build the single content-blind PowerShell probe. Pure; options are validated, never interpolated raw. */
export function buildNetworkQuery(options = {}) {
  const dnsName = HOST_RE.test(String(options.dnsProbeName || "")) ? String(options.dnsProbeName) : DEFAULT_DNS_PROBE_NAME;
  const probeHost = IP_RE.test(String(options.probeHost || "")) || HOST_RE.test(String(options.probeHost || "")) ? String(options.probeHost) : "";
  const reach = probeHost
    ? `$reach=[bool](Test-NetConnection -ComputerName '${probeHost}' -Port 53 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction SilentlyContinue); `
    : "$reach=$false; if($gw){ $reach=[bool](Test-Connection -ComputerName $gw -Count 1 -Quiet -ErrorAction SilentlyContinue) } "
      + "elseif($dnsSrv){ $reach=[bool](Test-NetConnection -ComputerName $dnsSrv -Port 53 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction SilentlyContinue) }; ";
  return (
    "$a=Get-NetAdapter -ErrorAction SilentlyContinue | Select-Object Status; " +
    "$gw=(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1).NextHop; " +
    "$dnsSrv=$null; try { $dnsSrv=(Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object {$_.ServerAddresses} | Select-Object -First 1).ServerAddresses[0] } catch {}; " +
    `$dns=$null; try { $dns=Resolve-DnsName -Name '${dnsName}' -Type A -QuickTimeout -ErrorAction Stop } catch {}; ` +
    reach +
    "[pscustomobject]@{adapters=@($a|ForEach-Object{$_.Status});dnsOk=[bool]$dns;ok=[bool]$reach;hasGateway=[bool]$gw} | ConvertTo-Json -Compress"
  );
}

let lastDown = false; // edge-trigger: only emit on transition into a failed state
let lastDnsFail = false;
let lastConn = { fails: 0, down: false };

/** Pure evaluator. Input: { adapters:[statusString], dnsOk:bool }. Output: signals. */
export function evaluateNetwork(raw, prev = {}) {
  const row = toArray(raw)[0] || raw || {};
  const adapters = toArray(row?.adapters).map((s) => String(s || "").toLowerCase());
  const anyUp = adapters.some((s) => s === "up" || s === "2");
  const dnsOk = Boolean(row?.dnsOk);
  // If there are no adapters reported at all, treat as "unknown", not "down".
  const adapterDown = adapters.length > 0 && !anyUp;
  const dnsFail = anyUp && !dnsOk; // DNS failure only meaningful when a link is up

  const signals = [];
  if (adapterDown && !prev.down) signals.push({ signal: "NET.ADAPTER.DOWN", hint: "no-adapter-up" });
  if (dnsFail && !prev.dnsFail) signals.push({ signal: "NET.DNS.FAIL", hint: "dns-probe-failed" });
  return { signals, state: { down: adapterDown, dnsFail } };
}

// ===== RUN 13 — internet-down detection (2 consecutive reachability failures) =====
// Pure, stateful. Caller feeds each probe's boolean result; a single blip is ignored, two in a row
// emit NET.DOWN exactly once (edge-triggered) so the globe can pop the troubleshoot bubble.
export function evaluateConnectivity(state, reachable) {
  const fails = reachable ? 0 : (Number(state?.fails) || 0) + 1;
  const wasDown = Boolean(state?.down);
  const down = fails >= 2;
  const signals = [];
  if (down && !wasDown) signals.push({ signal: "NET.DOWN", hint: "internet-unreachable" });
  return { signals, state: { fails, down } };
}

export function createNetworkWatcher({ emit, isBlocked, options = {} }) {
  const query = buildNetworkQuery(options);
  return {
    name: "network",
    cadenceMs: NETWORK_CADENCE_MS,
    spawnsPerTick: 1, // adapter state + DNS + reachability in ONE probe
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(query);
      if (raw == null) return;
      const { signals, state } = evaluateNetwork(raw, { down: lastDown, dnsFail: lastDnsFail });
      lastDown = state.down;
      lastDnsFail = state.dnsFail;
      for (const s of signals) emit(s.signal, s.hint);
      // Reachability (RUN 13): 2 consecutive failures → NET.DOWN (globe troubleshoot bubble).
      const row = toArray(raw)[0] || raw || {};
      const reachable = Boolean(row?.ok);
      const conn = evaluateConnectivity(lastConn, reachable);
      lastConn = conn.state;
      for (const s of conn.signals) emit(s.signal, s.hint);
    }
  };
}

export function __resetNetworkState() {
  lastDown = false;
  lastDnsFail = false;
  lastConn = { fails: 0, down: false };
}
