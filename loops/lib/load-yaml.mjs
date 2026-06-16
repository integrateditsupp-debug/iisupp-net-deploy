// loops/lib/load-yaml.mjs — minimal YAML reader (flat keys + block scalars).
// Good enough for the loop-record format. Zero deps.
// For richer YAML, swap for a real parser.

import { readFileSync } from 'node:fs';

export function loadYAML(path) {
  const raw = readFileSync(path, 'utf8');
  return parseYAML(raw);
}

export function parseYAML(raw) {
  const out = { _raw: raw };
  let key = null, buf = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (m && !line.startsWith(' ')) {
      if (key && buf.length) out[key] = buf.join('\n').trim();
      key = m[1];
      const v = m[2].trim();
      if (v === '|' || v === '>') { buf = []; }
      else if (v === '') { buf = []; }
      else { out[key] = v; key = null; buf = []; }
    } else if (key && line.startsWith(' ')) {
      buf.push(line.replace(/^\s{2}/, ''));
    }
  }
  if (key && buf.length) out[key] = buf.join('\n').trim();
  return out;
}
