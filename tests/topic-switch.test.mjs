// RUN 25-2 — topic-switch detector. Jaccard overlap of significant tokens < 0.15 → switch (drop context).
// Continuations/affirmations (no significant tokens) are never switches, so guided/resolve flows survive.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const NLU = require('../assets/aria-nlu-tier23.js');

let n = 0; const t = () => { n++; };

// 1 — the live-test failure: printer → DNS is a clear switch (context must be dropped).
assert.equal(NLU.isTopicSwitch('my printer is jammed and offline', 'DCs cannot resolve each other after the ISP change'), true, 'printer → DNS is a topic switch');
t();

// 2 — staying on the same topic (printer step 1 → printer step 2) is NOT a switch.
assert.equal(NLU.isTopicSwitch('my printer keeps jamming', 'the printer still jams after step one'), false, 'printer → printer is not a switch');
t();

// 3 — short replies (≤1 significant token) are never switches — too little signal to flip topic. Multi-word
//     continuations like "walk me through" are gated by the CALLER (it routes them before topic-switch runs).
for (const cont of ['yes', 'do it', 'go ahead', 'next', 'ok thanks', 'sure', 'please']) {
  assert.equal(NLU.isTopicSwitch('my outlook will not open', cont), false, `one-word reply is not a switch: "${cont}"`);
}
t();

// 4 — cross-domain expert switches (AD → virtualization) are detected.
assert.equal(NLU.isTopicSwitch('gpupdate shows the wrong group policy on the controller', 'the hyper-v host datastore latency is spiking on the veeam backup'), true, 'AD → virtualization switch');
t();

// 5 — paraphrase / heavy overlap stays on-topic (not a switch).
assert.equal(NLU.isTopicSwitch('the vpn tunnel keeps disconnecting randomly', 'vpn tunnel disconnecting again randomly'), false, 'paraphrase of same issue is not a switch');
t();

// 6 — edge cases: empty / whitespace prior or new message → not a switch (cannot judge, do not reset).
assert.equal(NLU.isTopicSwitch('', 'printer is broken'), false, 'empty prior → not a switch');
assert.equal(NLU.isTopicSwitch('printer is broken', '   '), false, 'empty new → not a switch');
assert.equal(NLU.isTopicSwitch(null, undefined), false, 'null inputs → not a switch');
// and significantTokens drops <=3-char tokens + stopwords as specified
assert.deepEqual(NLU.significantTokens('the dns is on ad now').filter(x => x.length <= 3), [], 'tokens <=3 chars are dropped');
t();

assert.equal(n, 6, '6 topic-switch test groups');
console.log(`topic-switch test passed (${n} groups · printer→DNS switch · same-topic stays · continuations safe · cross-domain · paraphrase · empty edges).`);
