// code-host-remote.mjs — is this remote the shared line, or a mirror of it?
//
// WHY THIS EXISTS (RUN-BV, 2026-10-08, found while using the thing it fixes).
// Every emit since RUN-BD has published a field called `mainRef` under the words "the shared line,
// as the code host reports it". Every one of them in fact published whatever `origin` happened to
// point at. Verification runs in a clone made with `git clone --shared <local path>` — which sets
// `origin` to that LOCAL PATH — so this cycle's first emit read the BUILD MACHINE's own main
// (1f6c0d77), five pushes out of date, and published it as the shared line. The number was wrong,
// it was shaped exactly like a right one, and no test could go red about it: `git ls-remote origin`
// succeeded, which is the whole problem.
//
// The fix is to classify the remote before believing it. A local path, a Windows drive path, a
// relative path, a file: URL or a missing origin is NOT the code host — the reading is refused and
// reported unread, which is a fact an operator can act on. Refusing errs toward "we do not know",
// never toward a confident wrong answer (Rule 14).
//
// Pure, and in its own module rather than exported from the emit script, because importing that
// script RUNS a cycle — a test that wanted this predicate would have emitted a feed to get it.
export const CODE_HOST_REMOTE_SCHEMA = "code-host-remote.v1";
export const SENDS = false;

/** True only for a remote that can reach a real code host over a real transport. */
export function isCodeHostRemote(url) {
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;
  // Local in every shape git accepts: absolute, relative, home-relative, Windows drive, file: URL.
  if (u.startsWith(".") || u.startsWith("/") || u.startsWith("~")) return false;
  if (/^[A-Za-z]:[\\/]/.test(u)) return false;
  if (/^file:/i.test(u)) return false;
  // A real transport, or git's scp-like shorthand (user@host:path).
  if (/^(https?|git|ssh):\/\//i.test(u)) return true;
  return /^[^/\s]+@[^/\s:]+:/.test(u);
}

/** Why a remote was refused, for an operator reading the internal payload. */
export function remoteClassification(url) {
  if (typeof url !== "string" || !url.trim()) {
    return { codeHost: false, reason: "no origin remote is configured in this checkout" };
  }
  if (isCodeHostRemote(url)) return { codeHost: true, reason: null };
  return {
    codeHost: false,
    reason: "origin is a local path or file URL — a mirror's main is not the shared line, and is never published as one",
  };
}
