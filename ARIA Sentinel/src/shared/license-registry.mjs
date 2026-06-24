// license-registry — pure helpers for the device check-in registry + admin search. Records live in
// Netlify Blobs (the function layer); this owns the search + idempotent device-upsert logic.
// Content note: stores only what the user supplied at activation (name/company/email) + device meta.

/**
 * Substring search across key/email/first/last/company (case-insensitive), paginated.
 * @param {Array} records license records
 * @param {string} q
 * @param {object} opts { page=1, pageSize=25 }
 */
export function searchLicenses(records = [], q = "", opts = {}) {
  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.max(1, Number(opts.pageSize) || 25);
  const term = String(q || "").trim().toLowerCase();
  const all = (Array.isArray(records) ? records : []).filter((r) => {
    if (!term) return true;
    return [r.license_key, r.email, r.first_name, r.last_name, r.company]
      .some((f) => String(f || "").toLowerCase().includes(term));
  });
  const start = (page - 1) * pageSize;
  return {
    total: all.length,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(all.length / pageSize)),
    results: all.slice(start, start + pageSize)
  };
}

/**
 * Idempotent device upsert on a license record. Same device_id updates in place (last_seen/version);
 * a new device_id is appended. Returns a NEW record (pure).
 * @param {object} record license record (may be null → seeded from device.license fields)
 * @param {object} device { device_id, os, version, last_seen }
 */
export function registerDevice(record, device = {}) {
  const base = record && typeof record === "object" ? { ...record } : {
    license_key: device.license_key || "",
    email: device.email || null,
    first_name: device.first_name || null,
    last_name: device.last_name || null,
    company: device.company || null,
    plan: device.plan || null,
    version_pin: null
  };
  const devices = Array.isArray(base.devices) ? base.devices.slice() : [];
  const entry = {
    device_id: String(device.device_id || ""),
    os: device.os || null,
    version: device.version || null,
    last_seen: device.last_seen || new Date().toISOString()
  };
  const idx = devices.findIndex((d) => d.device_id === entry.device_id);
  if (idx === -1) devices.push(entry);
  else devices[idx] = { ...devices[idx], ...entry };
  return { ...base, devices };
}
