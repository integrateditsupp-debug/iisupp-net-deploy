// Stage approved-template initial outreach as Gmail DRAFTS (never sends).
// Honours suppression_list. Writes draft_id back to outreach_items.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const cl = JSON.parse(fs.readFileSync('data/secrets/gmail-oauth-client.json','utf8'));
const tk = JSON.parse(fs.readFileSync('data/secrets/gmail-tokens.json','utf8'));

const r = await fetch('https://oauth2.googleapis.com/token', { method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({ client_id:cl.client_id, client_secret:cl.client_secret,
    refresh_token:tk.refresh_token, grant_type:'refresh_token' })});
const tok = await r.json();
if (!tok.access_token) { console.error('TOKEN_FAIL', JSON.stringify(tok)); process.exit(1); }
const AT = tok.access_token;

const prof = await (await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',
  { headers:{ authorization:'Bearer '+AT }})).json();
console.log('ACCOUNT =', prof.emailAddress);

const db = new DatabaseSync('data/axis-sales.db');
const supp = db.prepare('SELECT email FROM suppression_list').all().map(x=>x.email.toLowerCase());
const items = db.prepare("SELECT id,to_email,subject,body FROM outreach_items WHERE kind='initial' AND status='pending' AND sent_at IS NULL ORDER BY id").all();

const b64u = s => Buffer.from(s,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const enc  = s => /[^\x20-\x7E]/.test(s) ? '=?UTF-8?B?'+Buffer.from(s,'utf8').toString('base64')+'?=' : s;

let made=0, skipped=0;
for (const it of items) {
  const to = (it.to_email||'').toLowerCase();
  const dom = '@'+to.split('@')[1];
  if (supp.includes(to) || supp.includes(dom)) { console.log('SKIP suppressed:', it.to_email); skipped++; continue; }

  const mime = [
    'From: Ahmad Wasee <'+prof.emailAddress+'>',
    'To: '+it.to_email,
    'Subject: '+enc(it.subject),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit','', it.body ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method:'POST', headers:{ authorization:'Bearer '+AT, 'content-type':'application/json' },
    body: JSON.stringify({ message:{ raw: b64u(mime) } }) });
  const out = await res.json();
  if (!res.ok) { console.error('FAIL id'+it.id, JSON.stringify(out).slice(0,200)); continue; }
  db.prepare('UPDATE outreach_items SET draft_id=? WHERE id=?').run(out.id, it.id);
  console.log('DRAFT ok  id'+it.id+'  -> '+it.to_email+'  draft='+out.id);
  made++;
}
console.log('SUMMARY drafts='+made+' skipped='+skipped+' of '+items.length);
db.close();
