const { test } = require('node:test');
const assert = require('node:assert/strict');
const { workspaceIntent } = require('../netlify/functions/lib/axis-workspace-intent.cjs');
test('explicit pull-up goes directly to on-screen work', () => {
  assert.equal(workspaceIntent('pull up my client follow-ups'), 'pull up my client follow-ups');
  assert.equal(workspaceIntent("Axis, let's work on the marketing campaign"), "Axis, let's work on the marketing campaign");
});
test('PC commands remain on the local approval path', () => {
  assert.equal(workspaceIntent('pull up a local file on my computer'), null);
  assert.equal(workspaceIntent('show me how to run a command in powershell'), null);
});
test('normal chat and empty requests do not create work', () => {
  assert.equal(workspaceIntent('hello Axis'), null);
  assert.equal(workspaceIntent('pull up'), null);
});