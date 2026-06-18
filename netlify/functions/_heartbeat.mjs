import { getStore } from '@netlify/blobs';
export async function beat(cronName) {
  try {
    const store = getStore({ name: 'aria-cron-heartbeats' });
    await store.setJSON('hb-' + cronName, {
      cron_name: cronName,
      last_run: Date.now(),
      last_run_iso: new Date().toISOString()
    });
  } catch (e) {}
}
