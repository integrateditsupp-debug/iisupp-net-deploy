import { beat } from './_heartbeat.mjs';
import {
  CONTENT_ASSURANCE_PURGE_LOG,
  CONTENT_ASSURANCE_STORE,
  getScopedStore
} from './lib/content-assurance.mjs';

export const config = { schedule: '*/5 * * * *' };

export default async () => {
  await beat('ca-purge-cron');
  const store = getScopedStore(CONTENT_ASSURANCE_STORE);
  const logStore = getScopedStore(CONTENT_ASSURANCE_PURGE_LOG);
  const list = await store.list();
  const now = Date.now();
  const purged = [];

  for (const blob of (list.blobs || [])) {
    const session = await store.get(blob.key, { type: 'json' });
    if (!session?.expiresAt) continue;
    const expiresAt = new Date(session.expiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt > now) continue;
    await store.delete(blob.key);
    const record = {
      sessionId: session.sessionId || blob.key,
      purgedAt: new Date().toISOString(),
      ageSeconds: Math.max(0, Math.round((now - expiresAt) / 1000)),
      artifactKeysDeleted: [blob.key]
    };
    await logStore.setJSON('purge-' + (session.sessionId || blob.key) + '-' + now, record);
    purged.push(record);
  }

  return new Response(JSON.stringify({ ok: true, purgedCount: purged.length, purged }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
