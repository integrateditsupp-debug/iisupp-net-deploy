// AXIS approve-hop — the worker only auto-executes rail-safe items; irreversible/reject/no-intent HOLD for Ahmad.
import assert from 'node:assert/strict';
import { processAxisInbox } from '../scripts/lib/axis-inbox.mjs';

const items = [
  { id: 'a', action: 'approval', decision: 'approve' },                       // execute
  { id: 'b', action: 'approval', decision: 'reject' },                        // hold (reject)
  { id: 'c', action: 'command', intent: 'find leads', needsApproval: false }, // execute
  { id: 'd', action: 'command', intent: 'send to prospect', needsApproval: true }, // hold (irreversible)
  { id: 'e', action: 'command' },                                             // hold (no intent)
  { id: 'f' },                                                                // hold (no action)
];
const r = processAxisInbox(items);
assert.deepEqual(r.execute.map(x => x.id), ['a', 'c'], 'only rail-safe approve + concrete command execute');
for (const id of ['b', 'd', 'e', 'f']) assert.ok(r.hold.map(x => x.id).includes(id), `${id} holds for Ahmad`);
assert.deepEqual(r.consumed, ['a', 'c'], 'only executed items are consumed');
// never throws on bad input
assert.deepEqual(processAxisInbox(null).execute, [], 'null input safe');
assert.deepEqual(processAxisInbox([{}]).execute, [], 'item without id skipped');
console.log('axis-inbox approve-hop test passed (rail-safe execute · irreversible/reject/no-intent hold · consume-only-executed · graceful).');
