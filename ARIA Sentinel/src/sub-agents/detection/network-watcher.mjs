// network-watcher — fires NET.ADAPTER.DOWN / NET.DNS.FAIL.
// Sources: Get-NetAdapter (operational status) + Resolve-DnsName probe · cadence 30s.
// Content-blind: adapter names, MACs and IPs are read locally and DROPPED. Only the
// boolean "any adapter up" and "dns resolves" are evaluated.
import { runPowerShellJson, toArray } from "./ps.mjs";

// One probe: are any adapters Up, and does a known-good public name resolve?
// Resolve-DnsName against a stable anchor is a connectivity probe, not navigation —
// no URL is constructed and no page is fetched.
const QUERY =
  "$a=Get-NetAdapter -ErrorAction SilentlyContinue | Select-Object Status; " +
  "$dns=$null; try { $dns=Resolve-DnsName -Name 'microsoft.com' -Type A -QuickTimeout -ErrorAction Stop } catch {}; " +
  "[pscustomobject]@{adapters=@($a|ForEach-Object{$_.Status});dnsOk=[bool]$dns} | ConvertTo-Json -Compress";

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

export function createNetworkWatcher({ emit, isBlocked }) {
  return {
    name: "network",
    cadenceMs: 30 * 1000,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      const { signals, state } = evaluateNetwork(raw, { down: lastDown, dnsFail: lastDnsFail });
      lastDown = state.down;
      lastDnsFail = state.dnsFail;
      for (const s of signals) emit(s.signal, s.hint);
      // Reachability probe (RUN 13): 2 consecutive failures → NET.DOWN (globe troubleshoot bubble).
      const probe = await runPowerShellJson("[pscustomobject]@{ok=(Test-NetConnection -ComputerName 1.1.1.1 -Port 53 -InformationLevel Quiet)} | ConvertTo-Json -Compress");
      const reachable = probe == null ? true : Boolean(toArray(probe)[0]?.ok ?? probe?.ok);
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
