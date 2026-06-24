// fleet — multi-tenant aggregation for the MSP single-pane dashboard. PURE. Customers are identified
// ONLY by opaque handles (per privacy rule R11) — never a real company name. One row per customer:
// endpoint count · average health · fixes this week · last seen.
export function aggregateFleet(tenants = []) {
  const rows = (Array.isArray(tenants) ? tenants : []).map((t) => {
    const endpoints = Array.isArray(t.endpoints) ? t.endpoints : [];
    const healths = endpoints.map((e) => Number(e.health)).filter(Number.isFinite);
    const healthAvg = healths.length ? Math.round(healths.reduce((a, b) => a + b, 0) / healths.length) : 0;
    const fixesWeek = endpoints.reduce((a, e) => a + (Number(e.fixesWeek) || 0), 0);
    const lastSeen = endpoints.reduce((m, e) => Math.max(m, Number(e.lastSeenMs) || 0), 0);
    return {
      handle: handleOf(t),
      endpoints: endpoints.length,
      healthAvg,
      fixesWeek,
      lastSeenMs: lastSeen
    };
  });
  return rows.sort((a, b) => a.handle.localeCompare(b.handle));
}

// Only ever expose a handle. If a caller passes a name, it is dropped, not surfaced.
function handleOf(t) {
  const h = String(t && t.handle ? t.handle : "").trim();
  return /^[a-z0-9_-]{1,40}$/i.test(h) ? h : "cust-unknown";
}

export function filterFleet(rows, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.handle.toLowerCase().includes(q));
}

export function fleetTotals(rows) {
  return {
    customers: rows.length,
    endpoints: rows.reduce((a, r) => a + r.endpoints, 0),
    fixesWeek: rows.reduce((a, r) => a + r.fixesWeek, 0)
  };
}
