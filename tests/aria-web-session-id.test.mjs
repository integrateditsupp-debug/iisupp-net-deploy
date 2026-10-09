#!/usr/bin/env node
// aria-web-session-id.test.mjs — the ARIA web chat identifies a conversation with a per-TAB id, not a constant.
//
// Before 2026-10-08 aria.html posted `sessionId: 'web-' + 2861` for every visitor on earth, so the server-side
// conversation context (netlify/functions/_conversation-context.js) bled turns between strangers. aria-chat now
// trusts only /^[A-Za-z0-9_-]{16,80}$/. This static suite guards the client half: the constant is gone, a
// crypto.randomUUID() generator (with a base36 fallback) exists, it is kept in sessionStorage (never
// localStorage — tabs must not share it), and every aria-chat / session-memory post carries it.
//   node tests/aria-web-session-id.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

const page = read('aria.html');
const core = read('assets/aria-core.js');
const mem = read('assets/aria-session-memory-client.js');
const voice = read('assets/aria-voice-conversation.js');

console.log('[session-id] the constant is gone');
{
  ok('no `sessionId: 2861` literal', !/sessionId:\s*2861\b/.test(page));
  ok("no `'web-' + state.sessionId` concatenation", !/'web-'\s*\+\s*state\.sessionId/.test(page));
  ok('no `|| 2861` display fallback', !/\|\|\s*2861\b/.test(page));
  ok('no `state.sessionId++` counter', !/state\.sessionId\+\+/.test(page));
  ok('static chrome no longer shows the fake #2861', !/SESSION · #2861|session\/2861/.test(page));
}

console.log('[session-id] the generator exists and is per-tab');
{
  ok('makeWebSessionId uses crypto.randomUUID()', /function makeWebSessionId\(\)[\s\S]{0,400}crypto\.randomUUID\(\)/.test(page));
  ok('…with a 24-char base36 fallback', /for \(let i = 0; i < 24; i\+\+\) rnd \+= chars\[/.test(page) && /'0123456789abcdefghijklmnopqrstuvwxyz'/.test(page));
  ok("ids are prefixed 'web-' (uuid → 40 chars, fallback → 28: both inside the server's 16-80 rule)", /return 'web-' \+ rnd;/.test(page));
  ok('kept in sessionStorage under aria_web_session_id', /sessionStorage\.(getItem|setItem)\(WEB_SESSION_KEY/.test(page) && /WEB_SESSION_KEY = 'aria_web_session_id'/.test(page));
  ok('never written to localStorage', !/localStorage\.setItem\(WEB_SESSION_KEY/.test(page) && !/localStorage\.setItem\('aria_web_session_id'/.test(page));
  ok('stored id is re-validated against the server rule before reuse', /\^\[A-Za-z0-9_-\]\{16,80\}\$\/\.test\(id\)/.test(page));
  ok('state.sessionId is initialised from the generator', /sessionId:\s*getWebSessionId\(\)/.test(page));
  ok('a new session rotates the id instead of counting', /state\.sessionId = rotateWebSessionId\(\)/.test(page));
  ok('exposed as window.ariaWebSessionId for the asset clients', /window\.ariaWebSessionId = getWebSessionId/.test(page));
}

console.log('[session-id] every chat post carries it');
{
  ok('typed LLM path posts sessionId: state.sessionId', /messages: state\.llmHistory, sessionId: state\.sessionId/.test(page));
  ok('voice engine posts sessionId from the page (sessionId: function(){ return state.sessionId; })', /sessionId: function\(\)\{ return state\.sessionId; \}/.test(page));
  ok('voice engine body includes sessionId + voice:true', /sessionId: resolveSessionId\(\),\s*voice: true/.test(voice));
  ok('aria-core.js (homepage widget) generates its own per-tab id and posts it', /function ariaWebSessionId\(\)/.test(core) && /sessionStorage/.test(core) && /messages: ariaChatHistory, sessionId: ariaWebSessionId\(\)/.test(core));
  ok('session-memory client attaches the page id to its requests', /window\.ariaWebSessionId/.test(mem) && /sessionId: sid/.test(mem));
}

console.log(`\naria-web-session-id: ${pass} checks passed`);
