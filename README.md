# Campaign rollup projection service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Purely folds a caller-supplied work snapshot into the enterprise-to-task campaign ladder and selects bounded PreToolUse context. It acquires no work state and performs no hook output effect.

## Original Work topology and professional planning correctness

This pure reader projects an **existing Work snapshot** into campaign,
project, plan and task context. It is not a second task database, a GitHub
Project mutation, an authorized Work move, an independent assayer or an
operator settlement. The original upstream work/office/rights readers own
which source rows may be observed and what a verified result means.

**Dependencies cross the current view.** A campaign task is advancing only
when every declared exact `dependsOn` Work ID is present in the **whole**
supplied snapshot and has source-reported successful completion. Work in
another campaign/project is not silently discarded from precedence. An
unobserved, unfinished, abandoned or deferred predecessor holds the task;
a source cancellation is not the equivalent of completing its obligation.
The `dependencyHolds` readout supplies source Work IDs and explicit
unresolved reasons. A task with a `blockedBy` report remains blocked
separately. A self-reference or unresolved dependency cycle cannot generate
an executable suggestion. Distinct canonical Work IDs are required and
malformed dependency declarations refuse rather than selecting an arbitrary
record after a `Map` overwrite.

**One actionable frontier.** `campaign.front.advancing`,
`campaign.front.nextTask`, the `current` task and
`projectCampaignPretoolContext` all reuse the same source-derived
readiness. An appealing editor file-path match cannot recommend a held task.
A consumer MUST supply all relevant source Work rows and current revisions:
an incomplete input is not proof a missing external prerequisite is already
met. All ready and done standings remain claims from the supplied snapshot,
not independently checked real recipient acceptance.

**Operational example:** Project A's task needs Project B's open work. The
projected front of A reports a hold naming B's exact Work ID; a project
dashboard, personal current focus and edit hook do **not** nominate A's
task. When B's supplied source status becomes `done`, A becomes a
candidate without changing its identity. If B is abandoned or unavailable,
A remains held until original Work law and a competent receiver settle it.

**Qualification:** the same existing `test/campaign-rollup.test.mjs`
checks local and cross-project predecessors, missing source, withdrawn
work, cycles, invalid duplicate Work IDs, personal focus, editor hints
and a 512-task shared-prerequisite fixture. The repository's
`native-campaign-work` public workflow executes Node 22 source syntax
and the original suite. A passing workflow qualifies only these software
readouts: package publication, host selection, actual Asana/Jira/GitHub
permissions, source-size/rate-limited benchmarks, buyer acceptance and
economic settlement require independent receivers. Do not substitute a
greened test or static Work picture for a paid client outcome.


**Conflicting completion sources:** A generic imported `status: complete`
never overrides an explicit `workStatus: open`, `blocked` or `in-progress`.
The existing `front`, `progress`, Campaign-root filter, and personal Work
focus all use this same rule. The additive `sourceStatusConflicts` gives exact
source Work identifiers and both competing values (plus its count) so the
original owner can reconcile the discrepancy; it is an observation, not a new
Work state or a receiver's certificate. A conflict remains visible even
when an unrelated campaign is omitted from the current focus.
