// macOS network-watcher — fires NET.ADAPTER.DOWN / NET.DNS.FAIL.
// Sources: `scutil --dns` (are any resolvers configured?) + a single `ping -c1` connectivity probe.
// Cadence 30s. Content-blind: resolver IPs / interface names are read locally and DROPPED — only
// the booleans "has resolvers" and "ping ok" are evaluated. Edge-triggered like the Windows twin.
import { runShell } from "./sh.mjs";

let lastDown = false;
let lastDnsFail = false;

/** Pure: does `scutil --dns` output declare at least one nameserver? (boolean only). */
export function hasResolvers(scutilText) {
  return /nameserver\[\d+\]\s*:/i.test(String(scutilText || ""));
}

/** Pure: did `ping -c1` succeed? Look for the received-packets line, never an address. */
export function pingOk(pingText) {
  const m = String(pingText || "").match(/(\d+)\s+packets received/i);
  return Boolean(m && Number(m[1]) > 0);
}

/**
 * Pure evaluator. Input: { resolvers:bool, ping:bool } + prev state. Output: edge-triggered signals.
 * No resolvers at all → adapter/stack down. Resolvers present but ping fails → DNS/connectivity fail.
 */
export function evaluateNetwork({ resolvers, ping }, prev = {}) {
  const adapterDown = !resolvers;
  const dnsFail = resolvers && !ping;
  const signals = [];
  if (adapterDown && !prev.down) signals.push({ signal: "NET.ADAPTER.DOWN", hint: "no-resolvers" });
  if (dnsFail && !prev.dnsFail) signals.push({ signal: "NET.DNS.FAIL", hint: "ping-probe-failed" });
  return { signals, state: { down: adapterDown, dnsFail } };
}

export function createNetworkWatcher({ emit, isBlocked }) {
  return {
    name: "network",
    cadenceMs: 30 * 1000,
    async tick() {
      if (isBlocked()) return;
      const dnsText = await runShell("scutil", ["--dns"]);
      if (dnsText == null) return;
      // -c1 one packet, -t2 two-second deadline. A reachability probe, not navigation.
      const pingText = await runShell("ping", ["-c", "1", "-t", "2", "1.1.1.1"]);
      const sample = { resolvers: hasResolvers(dnsText), ping: pingOk(pingText) };
      const { signals, state } = evaluateNetwork(sample, { down: lastDown, dnsFail: lastDnsFail });
      lastDown = state.down;
      lastDnsFail = state.dnsFail;
      for (const s of signals) emit(s.signal, s.hint);
    }
  };
}

export function __resetNetworkState() {
  lastDown = false;
  lastDnsFail = false;
}
