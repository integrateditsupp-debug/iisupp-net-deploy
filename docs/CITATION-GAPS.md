# Citation gaps — what the pack promises that does not exist

Opened RUN-AX / AX2, 2026-08-11.

`scripts/lib/answer-citations.mjs` resolves every citation the twenty-seven client-facing documents
make against **HEAD's tree** — what a clone receives, never what happens to sit on the operator's
disk. Most resolve. A few name an artefact that is in the shared line under a different path, and
those are corrected in place: naming the real path is a repair, not a decision.

This register is for the third kind. An answer promises an artefact **nothing in the shared line
carries under any path** — a risk register, an asset inventory, a DR test log. That is not a typo.
Either the artefact should be written, or the answer should stop promising it, and both of those are
decisions about what this company represents to a security reviewer.

Deleting the sentence would make the count green and make the pack less honest, so nothing here is
deleted (Rule 15). Inventing the artefact would be worse: a risk register produced to satisfy a link
check is a fabricated control (Rule 14). So each gap is written down, with a reason and a named
decider, and reported on every run until it is closed.

The audit goes **red** on any gap that is not declared here, on any declaration that no longer
matches a real gap, and on any declaration without a reason or a named decider.

| Artefact | State | Reason a person wrote | Who decides |
|---|---|---|---|
| `governance/risk-management.html` | open | The SIG-Lite answer to "do you have a documented risk management program" sends the reviewer to a page at this address. The governance directory publishes twelve pages and this is not one of them; the nearest is `governance/information-security.html`, which is a different document about a different control. Either the risk-management page is written and published or the answer points somewhere that exists. It is the first substantive answer in the first questionnaire a reviewer opens. | Ahmad |
| `compliance/asset-inventory.md` | open | The SIG-Lite answer to "is an asset inventory maintained" says yes and cites this file, then lists the assets inline in the same sentence. The inline list is real and checkable; the file it points at has never been written. The honest repair is either to lift that list into the file the answer promises, or to stop promising a file and let the inline list be the answer. | Ahmad |
| `governance/dr-test-log.md` | open | The business-continuity policy states that restore testing is quarterly and that it is documented here. A reviewer who believes the cadence will ask for the log, and asking for evidence of restore testing is one of the two or three things a reviewer reliably does. There is no log because the tests have not been run and logged, so writing the file would be fabricating evidence. The decision is whether to run and log a restore test or to state the cadence as a target. | Ahmad |
| `governance/incident-history.md` | open | The incident-response policy cites an incident history in two places. There have been no incidents to record, which is a good fact and a bad citation: an empty file is honest, a missing file reads as a withheld one. Either an explicitly-empty history is published or the policy says there is no history yet. | Ahmad |
| `governance/risk-register.md` | open | The risk-management policy points at a register. The BCP carries a real risk table and the SOC 2 self-assessment carries another; neither is at this path. Consolidating them into the cited file is a real option and so is repointing the citation, but which one is right depends on whether the register is meant to be a live document or a section of an existing one. | Ahmad |
| `governance/vulnerability-tracker.md` | open | The vulnerability-management policy cites a tracker. Dependabot and CodeQL are real and produce their findings inside GitHub rather than in this repository, so the tracker is not missing so much as it lives somewhere a clone does not reach. The decision is whether to export it, cite the GitHub surface explicitly, or drop the claim to a description of the tooling. | Ahmad |
