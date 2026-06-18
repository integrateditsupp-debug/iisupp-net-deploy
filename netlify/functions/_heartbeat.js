/**
 * _heartbeat — tiny helper. Every cron calls await beat('cron-name') at the top.
 *  aria-cron-health-monitor reads aria-cron-heartbeats to detect stale crons.
 *  Failure-safe: never throws.
 */
async function beat(cronName) {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'aria-cron-heartbeats' });
    await store.setJSON('hb-' + cronName, {
      cron_name: cronName,
      last_run: Date.now(),
      last_run_iso: new Date().toISOString()
    });
  } catch (e) { /* swallow — never break cron */ }
}
module.exports = { beat };
