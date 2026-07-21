// axis-db.mjs — AXIS Command Center v2 system-of-record. WORKER-OWNED, LOCAL ONLY.
// Uses Node's built-in node:sqlite (Node 22.5+/24) — no better-sqlite3, no native build, no npm dep,
// and therefore zero chance of leaking into a Netlify function bundle. The DB lives at data/axis-sales.db
// which is gitignored + /data/* is 404-forced. Netlify functions NEVER import this; they read Blobs snapshots.
//
// Schema = FORGE-FINAL-BUILD-PROMPT §8. JSON-shaped columns are stored as TEXT (json1 helpers optional).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIPELINE_STAGES } from './axis-constants.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = path.join(REPO_ROOT, 'data');
export const SECRETS_DIR = path.join(DATA_DIR, 'secrets');
export const DB_PATH = process.env.AXIS_DB_PATH || path.join(DATA_DIR, 'axis-sales.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT UNIQUE,                 -- Lead-NNN anonymized handle (vault-safe)
  name TEXT, website TEXT, industry TEXT, city TEXT, region TEXT, size TEXT,
  address TEXT, phone TEXT, public_email TEXT, maps_url TEXT, linkedin_url TEXT, socials_json TEXT,
  maturity_it INTEGER, maturity_cyber INTEGER, maturity_cloud INTEGER, maturity_ai INTEGER,
  opportunities_json TEXT, est_monthly_value INTEGER,
  pipeline_stage TEXT DEFAULT 'Researching', stage_updated_at INTEGER,
  source_json TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER, name TEXT, title TEXT, public_email TEXT, linkedin_url TEXT,
  source_url TEXT, confidence REAL
);
CREATE TABLE IF NOT EXISTS outreach_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER, contact_id INTEGER, channel TEXT, kind TEXT,
  subject TEXT, body TEXT, facts_json TEXT,
  status TEXT DEFAULT 'pending', approval_notes TEXT, rejected_reason TEXT,
  approved_at INTEGER, sent_at INTEGER, gmail_message_id TEXT, thread_id TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS inbox_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id TEXT UNIQUE, thread_id TEXT, business_id INTEGER, contact_id INTEGER,
  direction TEXT, classification TEXT, subject TEXT, snippet TEXT,
  received_at INTEGER, actioned_at INTEGER, action_taken TEXT, snoozed_until INTEGER, unread INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outreach_item_id INTEGER, business_id INTEGER, due_at INTEGER, status TEXT DEFAULT 'scheduled'
);
CREATE TABLE IF NOT EXISTS pipeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER, from_stage TEXT, to_stage TEXT, cause TEXT, at INTEGER
);
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER, contact_id INTEGER, scheduled_at INTEGER, channel TEXT, status TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER, service TEXT, est_mrr INTEGER, status TEXT DEFAULT 'open'
);
CREATE TABLE IF NOT EXISTS crm_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT, fields_json TEXT, business_id INTEGER, created_at INTEGER, updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT, title TEXT, current_version_id INTEGER, status TEXT DEFAULT 'Draft'
);
CREATE TABLE IF NOT EXISTS document_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER, version INTEGER, body TEXT, merge_fields_json TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS products_discovered (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, category TEXT,
  demand INTEGER, ease INTEGER, profitability INTEGER, scalability INTEGER, advantage INTEGER,
  weighted_score REAL, evidence_json TEXT, status TEXT DEFAULT 'Idea', created_at INTEGER
);
CREATE TABLE IF NOT EXISTS suppression_list (
  email TEXT PRIMARY KEY, reason TEXT, added_at INTEGER
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT, started_at INTEGER, finished_at INTEGER, status TEXT, summary TEXT, outputs_json TEXT
);
CREATE TABLE IF NOT EXISTS approvals_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER, action TEXT, actor TEXT, detail TEXT, at INTEGER
);
CREATE TABLE IF NOT EXISTS consent_basis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER, basis TEXT, evidence_url TEXT, recorded_at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT
);
CREATE INDEX IF NOT EXISTS idx_biz_stage ON businesses(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_items(status);
CREATE INDEX IF NOT EXISTS idx_inbox_class ON inbox_messages(classification);
CREATE INDEX IF NOT EXISTS idx_inbox_actioned ON inbox_messages(actioned_at);
`;

export function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
}

// Open (creating if needed), apply schema, set safe pragmas. Returns the DatabaseSync handle.
export function openDb(dbPath = DB_PATH) {
  ensureDirs();
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  // Guard: pipeline_stage values must be from the canonical enum. Enforced in app code, not a CHECK
  // (so a future stage rename never bricks the DB); we validate on write via assertStage().
  return db;
}

export function assertStage(stage) {
  if (!PIPELINE_STAGES.includes(stage)) throw new Error(`invalid pipeline stage: ${stage}`);
  return stage;
}

export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(db, key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, v);
}
