// service-watcher — fires SYSTEM.SERVICE.STOPPED.<NAME> when a critical service
// transitions Running -> Stopped. Source: Get-Service · cadence 60s.
// Content-blind: the service set is a FIXED allow-list of Windows service short names
// (not user data), so the name is safe to carry in the symbolic signal.
import { runPowerShellJson, toArray } from "./ps.mjs";

// 8 critical services ARIA watches. Names are Windows service keys, not PII.
export const CRITICAL_SERVICES = [
  "Spooler", // Print Spooler
  "Dnscache", // DNS Client
  "Dhcp", // DHCP Client
  "wuauserv", // Windows Update
  "BITS", // Background Intelligent Transfer
  "WlanSvc", // WLAN AutoConfig
  "Audiosrv", // Windows Audio
  "LanmanWorkstation" // Workstation (SMB)
];

const SERVICE_SET = new Set(CRITICAL_SERVICES.map((s) => s.toLowerCase()));

// IDLE-NORMAL allow-list (2026-07-16 false-positive gate) — services whose designed state is Manual/Trigger-Start:
// they are STOPPED whenever Windows isn't actively using them, which is the healthy default (esp. `wuauserv`, whose
// "Windows Update stuck?" card was firing on every idle machine). For these, "stopped" ALONE is never a problem —
// we only alert with corroborating failure evidence, or when the registry says the service is truly Automatic.
// Kept intact for genuinely-down Automatic services (Spooler, Dnscache, …): those still fire on Running->Stopped.
export const IDLE_NORMAL_SERVICES = [
  "wuauserv",        // Windows Update — Manual (Trigger Start); stopped-when-idle is normal
  "bits",            // Background Intelligent Transfer — idle-normal between transfers
  "bthserv",         // Bluetooth Support — Trigger Start
  "dosvc",           // Delivery Optimization — Trigger Start
  "wbiosrvc",        // Windows Biometric — Trigger Start
  "trustedinstaller" // Windows Modules Installer — Manual, runs on demand
];
const IDLE_NORMAL_SET = new Set(IDLE_NORMAL_SERVICES.map((s) => s.toLowerCase()));

// Include StartType so the gate can read the service's REAL startup mode (Automatic vs Manual/Trigger vs Disabled)
// before deciding a "stopped" is worth surfacing. Absent StartType (older query / tests) falls back to the name list.
const QUERY =
  `Get-Service -Name ${CRITICAL_SERVICES.join(",")} -ErrorAction SilentlyContinue | ` +
  "Select-Object Name,Status,StartType | ConvertTo-Json -Compress";

/**
 * Pure transition evaluator. `prev` is a map of serviceName -> "Running"|"Stopped".
 * Emits a signal only on a Running->Stopped edge for an allow-listed service — AND only when that stop is a real
 * problem: an idle-normal / Manual / Disabled service that is simply stopped is suppressed (2026-07-16 gate). A
 * row may carry `StartType`/`Start` (real startup mode) and/or `Failing` (corroborating failure evidence).
 *
 * FAULT LAB 2026-10-14 (defect 5) — one exception to the Disabled suppression: a watched service that Windows needs
 * RUNNING (an allow-listed service NOT on the idle-normal list — Spooler, Dhcp, WlanSvc, Audiosrv, …) that goes from
 * Running to Stopped with its START TYPE set to Disabled. Before, that was silent (the lab's `spooler-disabled`: the
 * printer just stopped working and ARIA said nothing). It now emits the SAME stopped-service signal with
 * `startType: "disabled"` and hint "critical-service-disabled", so the card can say "disabled (start type), not just
 * stopped — needs an administrator". Idle-normal services (wuauserv, BITS, …) stay suppressed when Disabled — an
 * administrator disabling those is a common, deliberate policy — and a service already Disabled when the watcher starts
 * (no Running edge) stays quiet, like every other edge-triggered signal.
 */
export function evaluateServices(prev, raw) {
  const prevMap = prev || {};
  const nextMap = { ...prevMap };
  const signals = [];
  for (const row of toArray(raw)) {
    const name = String(row?.Name || "").trim();
    if (!name || !SERVICE_SET.has(name.toLowerCase())) continue; // ignore anything off the allow-list
    const status = normalizeStatus(row?.Status);
    const before = prevMap[name];
    if (before === "Running" && status === "Stopped") {
      if (shouldAlertOnStop(name, row)) {
        signals.push({ signal: `SYSTEM.SERVICE.STOPPED.${name.toUpperCase()}`, hint: "critical-service-stopped" });
      } else if (isDisabledCriticalStop(name, row)) {
        signals.push({ signal: `SYSTEM.SERVICE.STOPPED.${name.toUpperCase()}`, hint: "critical-service-disabled", startType: "disabled" });
      }
    }
    nextMap[name] = status;
  }
  return { state: nextMap, signals };
}

/** (defect 5) A watched, normally-running service stopped with its start type set to Disabled. Pure. */
export function isDisabledCriticalStop(name, row) {
  if (IDLE_NORMAL_SET.has(String(name).toLowerCase())) return false; // Manual/Trigger by design: Disabled is a policy
  return normalizeStartType(row?.StartType ?? row?.Start) === "Disabled";
}

/**
 * Should a Running->Stopped edge raise a card? Gate (2026-07-16):
 *  · Corroborating failure evidence (row.Failing) → ALWAYS alert, whatever the startup mode.
 *  · Explicit Manual / Disabled startup mode → suppress (stopped is the designed, healthy state).
 *  · Explicit Automatic startup mode → alert (a service that is SUPPOSED to run is down).
 *  · Unknown startup mode (no StartType in the row) → fall back to the idle-normal name list: suppress only for
 *    known Manual/Trigger services (wuauserv, BITS, …); otherwise alert (preserves the pre-gate coverage + tests).
 */
export function shouldAlertOnStop(name, row) {
  if (row && (row.Failing === true || row.failing === true)) return true; // real failure evidence overrides
  const startType = normalizeStartType(row?.StartType ?? row?.Start);
  if (startType === "Manual" || startType === "Disabled") return false;   // designed to sit stopped
  if (startType === "Automatic") return true;                              // should be running, and isn't
  return !IDLE_NORMAL_SET.has(String(name).toLowerCase());                 // unknown mode → name-list fallback
}

function normalizeStatus(value) {
  // Get-Service Status can serialise as the enum number (4 = Running) or the string.
  const text = String(value ?? "").trim();
  if (text === "4" || /running/i.test(text)) return "Running";
  if (text === "1" || /stopped/i.test(text)) return "Stopped";
  return text || "Unknown";
}

/**
 * Normalise a Windows startup mode. Sources: PowerShell ServiceStartMode enum (Boot=0/System=1/Automatic=2/
 * Manual=3/Disabled=4) OR the registry `Start` value (same numbering) OR the enum name string. Boot/System are
 * always-on critical services → treated as Automatic. Anything unrecognised → "Unknown" (name-list fallback).
 */
export function normalizeStartType(value) {
  if (value == null || value === "") return "Unknown";
  const text = String(value).trim();
  if (text === "2" || text === "0" || text === "1" || /automatic|boot|system/i.test(text)) return "Automatic";
  if (text === "3" || /manual|trigger/i.test(text)) return "Manual";
  if (text === "4" || /disabled/i.test(text)) return "Disabled";
  return "Unknown";
}

export function createServiceWatcher({ emit, isBlocked }) {
  let state = {};
  return {
    name: "service",
    cadenceMs: 60 * 1000,
    spawnsPerTick: 1,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      const result = evaluateServices(state, raw);
      state = result.state;
      // (defect 5) the start-type context travels with the signal (a fixed enum, never service output).
      for (const s of result.signals) emit(s.signal, s.hint, s.startType === "disabled" ? { startType: "disabled" } : undefined);
    }
  };
}
