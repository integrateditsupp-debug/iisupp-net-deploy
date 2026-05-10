// aria-vs-shared.jsx — team data + helpers shared across all acts
window.VS_TEAM = [
  { name: "Marcus T.",  role: "L1 Agent" },
  { name: "Priya S.",   role: "L1 Agent" },
  { name: "Diego R.",   role: "L1 Agent" },
  { name: "Ayesha K.",  role: "L2 Agent" },
  { name: "Tom W.",     role: "L2 Agent" },
  { name: "Lena M.",    role: "L3 Lead"  },
  { name: "Jordan F.",  role: "L3 Lead"  },
];

// state schedule (relative to t=0 of Act 1, scaled to act length)
window.VS_SCHEDULES = [
  [[0,8,"active",0.8],[8,14,"frust",0.35],[14,22,"active",0.6],[22,30,"break",0.7],[30,45,"active",0.7]],
  [[0,18,"train",0.85],[18,38,"active",0.85],[38,45,"break",0.8]],
  [[0,45,"pto",0]],
  [[0,12,"pto",0],[12,18,"meet",0.7],[18,32,"active",0.85],[32,38,"frust",0.4],[38,45,"active",0.7]],
  [[0,30,"active",0.85],[30,34,"frust",0.45],[34,42,"active",0.7],[42,45,"break",0.8]],
  [[0,18,"meet",0.8],[18,30,"active",0.85],[30,38,"meet",0.75],[38,45,"active",0.7]],
  [[0,16,"active",0.85],[16,28,"frust",0.3],[28,40,"active",0.6],[40,45,"break",0.7]],
];

window.VS_STATE_LABELS = {
  active: "ACTIVE", break: "BREAK", frust: "FRUSTRATED",
  train: "TRAINING", pto: "PTO", meet: "MEETING",
};

window.vsAgentAt = function(i, t) {
  const sched = VS_SCHEDULES[i];
  for (const [s, e, st, mood] of sched) if (t >= s && t < e) return { state: st, mood };
  const last = sched[sched.length - 1];
  return { state: last[2], mood: last[3] };
};

window.vsProductiveCount = function(t) {
  let n = 0;
  for (let i = 0; i < VS_TEAM.length; i++) if (vsAgentAt(i, t).state === "active") n++;
  return n;
};

window.vsRamp = (t, start, dur=1) => Math.min(1, Math.max(0, (t - start) / dur));
window.vsFmt = (n) => "$" + Math.round(n).toLocaleString();
