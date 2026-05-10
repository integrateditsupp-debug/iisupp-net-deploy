# ARIA — Claude Code Implementation Brief

> **For Claude Code.** The user will paste KBs (knowledge bases, internal docs, API keys, infra credentials) **after** you confirm architecture. Until then, plan only — do not assume infra. The visual reference is in this same package: open `ARIA Demo.html`, `ARIA vs Human Desk.html`, `ARIA Concept.html`. The new black-and-gold luxury aesthetic **overrides** the current iisupport.net look.

---

## 0 · Mission
Refactor and modernize the existing ARIA codebase (`iisupport.net`) into a flawless enterprise-grade AI assistant ecosystem on **iOS · Android · iPadOS · Windows · macOS · Web**. Match the cinematic prototype's premium feel without breaking what works.

**Hard constraints**
- Do **not** break working features. Land changes behind feature flags.
- Do **not** mock AI behavior. Wire to real LLM + voice providers from day one (KBs supplied after planning).
- No fake numbers, no slop, no hardcoded "AI thinking" delays.
- Every action must be auditable (signed action ledger — see Resolve scene in demo).

---

## 1 · Target platforms & stack
| Surface | Stack | Notes |
|---|---|---|
| iOS / Android / iPad | **React Native + Expo (SDK 51+)** + react-native-skia for the globe | One codebase. Use Expo Router. |
| Windows | **React Native Windows** (preferred) or Electron wrapper around the web build | RN Windows reuses the RN tree. |
| macOS | **React Native macOS** or Electron | Same code as Windows path. |
| Web (iisupport.net) | **Next.js 14 App Router** + Tailwind + shadcn/ui | Server components for KB fetch; client islands for voice/globe. |
| Shared | TypeScript everywhere · Zod schemas · TanStack Query · Zustand for client state | One `packages/shared` workspace. |

**Monorepo:** pnpm + Turborepo.
```
/apps
  /web        — Next.js (replaces current iisupport.net front-end)
  /mobile     — Expo (iOS + Android + iPad)
  /desktop    — RN Windows / macOS
/packages
  /ui         — shared components (Globe, MicButton, BrowserPane, ChatBubble, AuditTrail)
  /design     — tokens (port aria-tokens.css → ts), motion presets, fonts
  /aria-core  — orchestrator, voice pipeline, tool router, audit ledger
  /sdk        — typed client for backend (chat/voice/browse/exec endpoints)
/services
  /api        — Node/Fastify or NestJS — chat + voice + tool routing
  /worker     — long-running task runner (browser automation, exec)
  /signer     — action-ledger signer (HSM-backed in prod)
```

---

## 2 · Architecture
```
Client (RN / Next)
  ├── Voice pipeline ──► /api/voice (WS, full-duplex)
  ├── Chat stream ─────► /api/chat (SSE)
  ├── Tool execution ──► /api/exec (REST + WS for cursor/screen events)
  └── Browser mode ────► /api/browse (Playwright in worker)
                           │
Backend (services/api)     ▼
  Orchestrator (LLM-agnostic)
    ├── Voice STT/TTS gateway (Deepgram / ElevenLabs / Azure)
    ├── LLM router (Anthropic primary, OpenAI fallback)
    ├── Tool registry (typed JSON-schema tools)
    ├── Memory (short-term: Redis · long-term: Postgres + pgvector)
    ├── Browser worker pool (Playwright + screenshot stream)
    ├── Action ledger (every tool call signed, append-only)
    └── Escalation hooks (SIP/Teams/Slack handoff to human L2/L3)
```

**Why these choices:** all swappable behind interfaces in `aria-core`. No vendor lock-in.

---

## 3 · Critical features — implementation map

### 3.1 Voice (the hardest part)
- **Full-duplex WebSocket** to `/api/voice` — never half-duplex.
- **Interruption is non-negotiable:**
  - Client maintains `aria.speaking` state. On any incoming user audio frame above VAD threshold while `speaking === true`:
    1. Cancel TTS playback locally (`audio.pause()` + clear queue).
    2. Send `{type:"barge_in"}` upstream → server cancels current LLM stream + TTS synthesis job.
    3. STT continues uninterrupted; LLM resumes from new turn with prior partial response in context.
  - Provide `<200ms` end-to-end barge-in latency budget.
- **STT**: streaming (Deepgram Nova-3 or Whisper streaming). Send 20ms PCM frames.
- **TTS**: streaming chunked (ElevenLabs Turbo v2.5 or Azure Neural). Female, calm — match demo voice.
- **VAD**: Silero on-device for mobile; server-side fallback.
- Echo cancellation: WebRTC AEC on web; native AEC on iOS/Android.
- **Senior-friendly**: rate 0.92, pitch 1.0, generous pauses, 2-clause sentences max.

### 3.2 Globe
- Three.js (web) / Skia (mobile). Single shader.
- States exported from `aria-core`: `idle | listening | thinking | speaking | acting | success | error`.
- Drives: rotation speed, particle density, glow intensity, ring counter-rotation, energy arc speed.
- See `aria-shared.jsx` `AnimatedGlobe` for the visual contract — port the math, not the SVG.

### 3.3 Browser assistant mode
- Playwright headless in worker pool. Stream **screenshot deltas** (or video) to client over WS.
- Overlay layer in client renders ARIA suggestion bubbles + cursor on top of the streamed frame.
- User can take over keyboard/mouse anytime → events forwarded to Playwright session.
- Strict per-domain allowlist for autonomous browsing in enterprise tenants.

### 3.4 Guided / Resolve / Escalate
Three explicit modes, user-selectable per ticket:
1. **Walk me through** — narrated steps, user drives. ARIA renders overlays.
2. **Resolve for me** — ARIA executes. Every action signed → audit ledger. User can intervene.
3. **Human escalate** — SIP / Teams / Slack handoff with full transcript + ledger attached.

### 3.5 Action ledger (security-critical)
- Append-only Postgres table; every tool call signed by `services/signer` (Ed25519, HSM-backed in prod).
- Format: `{ts, session, actor, tool, args, result, signature}`.
- Surfaces in UI as the Audit Trail panel (see Resolve scene).

### 3.6 Memory
- Session: Redis, 24h TTL.
- Long-term per-user: Postgres + pgvector. Explicit user opt-in per memory.
- Tenant-isolated. Encrypted at rest (KMS).

---

## 4 · Design system port
Port `aria-tokens.css` → `packages/design/tokens.ts`:
```ts
export const aria = {
  bg:       { deep:"#050402", base:"#0B0907", elev:"#14100B" },
  cream:    { full:"#EDE6D6", dim:"#C8BFA9", faint:"#807865" },
  gold:     { base:"#C9A567", bright:"#E8C988" },
  status:   { success:"#7FB37A", danger:"#D9665A" },
  line:     { soft:"rgba(237,230,214,0.06)", base:"rgba(237,230,214,0.10)", strong:"rgba(232,201,136,0.30)" },
  font:     { display:"Cormorant Garamond", body:"Inter", mono:"JetBrains Mono" },
  radius:   { sm:6, md:10, pill:999 },
  motion:   { entry:"cubic-bezier(0.4,0,0.2,1)" },
};
```
Components to lift directly:
- `<Globe state energy/>`
- `<MicButton state pulse/>`
- `<ChatBubble role kind/>`
- `<BrowserPane url children/>`
- `<AuditTrail entries/>`
- `<StatCard icon num label/>`
- `<ChoiceCard featured?/>`

---

## 5 · Migration from current iisupport.net
1. **Audit current site** — list every public route, every form, every backend call. Output: `MIGRATION.md`.
2. **Build new web app in parallel** at `beta.iisupport.net` behind auth.
3. **Cut over by route**, not big-bang. Keep current API contracts; new UI calls them.
4. **Session continuity** — read existing auth cookies during transition.
5. Keep **all SEO / public marketing pages** working. Redesign visually but preserve URLs and meta.

---

## 6 · Cost narrative — wire to live tier (`iisupp.net` pricing)
Source-of-truth tiers used in the comparison demo:
| Tier | ARIA / yr | Human team baseline (salary only) | Real loaded cost |
|---|---|---|---|
| Small business | **$156,000** | 4 agents × $75k = **$300k** | + training, attrition, mood, after-hours gaps |
| Mid-size | **$312,000** | 9–14 agents × $80k ≈ **$720k–$1.12M** | as above |
| Enterprise | **$625,000** | 10–20+ agents × $80k ≈ **$800k–$1.6M+** | global = millions/yr |

These exact numbers are rendered in `ARIA vs Human Desk.html` — keep the figures synced when iisupp.net pricing changes.

---

## 7 · Reliability & ops
- **SLOs**: 99.95% uptime; voice-barge-in p95 < 200ms; chat-stream first-token p95 < 600ms.
- **Observability**: OpenTelemetry → Grafana/Loki/Tempo. Per-tenant dashboards.
- **Feature flags**: GrowthBook or LaunchDarkly. Every new ARIA capability gated.
- **Rate limiting**: per-tenant + per-user token buckets at the edge.
- **PII**: redact in logs; KMS-encrypted at rest; SOC2-ready audit trail (already covered by ledger).
- **DR**: warm replica per region. Voice WS is stateless behind sticky LB.

---

## 8 · Demo storyboard (already produced — keep as marketing)
1. Intro — globe materializes
2. Search — luxury watch research
3. Choice — guided vs resolve
4. Resolve — autonomous fix + audit
5. Voice — Sarah & printer
6. Ops — L1/L2/L3 grid
7. Outro — brand lockup

`ARIA Demo.html` and `ARIA vs Human Desk.html` both have a built-in **● RECORD VIDEO** button (bottom-right) that uses `getDisplayMedia` + `MediaRecorder` to save MP4 (or WebM where the browser doesn't support MP4 — convert with HandBrake / ffmpeg `-c:v libx264`).

---

## 9 · Implementation plan — phases for Claude Code
**Phase 0 · Discovery (no code)**
- Inventory current iisupport.net code + KBs (user will paste).
- Produce `MIGRATION.md` + risk matrix.

**Phase 1 · Skeleton**
- Monorepo scaffold. Design tokens. Empty apps boot. Globe component renders on all targets.

**Phase 2 · Chat**
- `/api/chat` SSE wired to Anthropic. Streaming UI in web + mobile. Action ledger v1.

**Phase 3 · Voice**
- Full-duplex WS. Barge-in. STT/TTS providers behind interface.

**Phase 4 · Tools**
- Browser worker. Process-list / exec mock with audit. Walk-me-through overlay engine.

**Phase 5 · Tenanting + billing**
- Per-tenant config. Stripe billing aligned to small/mid/enterprise tiers.

**Phase 6 · Migration cutover**
- Route-by-route move from old iisupport.net to new web app.

**Phase 7 · Hardening**
- Pen-test, SOC2 prep, perf budget enforcement, accessibility audit (WCAG 2.2 AA).

---

## 10 · Edge cases — non-exhaustive checklist
- Network drop mid-voice → resume from last user turn, never replay TTS already heard.
- TTS provider outage → fall back to second provider; if both down, switch to text mode and tell user.
- LLM hallucinated tool args → schema-validate at the orchestrator; refuse + retry once.
- Concurrent sessions per user → soft-cap; share memory across.
- Senior user low-vision → respect prefers-reduced-motion + large-type mode.
- Screen reader users → all globe states have aria-live equivalents.
- Tenant data residency → region pinning per tenant.

---

## 11 · What the user will paste next
- Internal KBs (product docs, current code, API keys, infra creds).
- After receiving them: re-confirm architecture against reality, then begin Phase 0 → 1.

**Until then, plan only.**
