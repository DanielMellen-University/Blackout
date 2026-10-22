# Gameplay overhaul scope, 10.994

## 1. Status and goals

Plan only. Daniel approved this docs-only scope on October 22, 2026 via CoS, b29 option C, narrowed to Part 1. Roadmap step 4 awaits Daniel's choices. The only gameplay implementation approved since this scope is Daniel's direct October 22, 2026 decision for b30: scored missions have a deterministic minimum of 15 and maximum of 100 ordered gates. No other overhaul implementation or first slice is approved. Every overhaul phase and every design choice needs separate approval from Daniel before any code is written. Recommendations below are proposals, not decisions or new approved roadmap items.

Goals proposed for approval:

- Make the existing loop clear: choose a mission, understand its goal, take off, fly 15 to 100 ordered gates, return, land, review the result, and choose a meaningful retry or next mission.
- Make progression understandable and compatible with generated worlds and bounded existing records.
- Explain what earns score and medals, including the difference between a gate split and a complete-circuit time.
- Give briefing, flight and debrief consistent priorities without adding mission types, themes or systems.
- Preserve the shipped flying experience and performance work while keeping future approved changes small and reviewable.

## 2. Current gameplay loop audit

This is a source review of origin/main `ee900dc8` (10.993), not a new flight, performance audit or usability study. File links name the implementation behind each finding.

### Selection, briefing and flight

[CourseLibrary.ts](../../src/systems/CourseLibrary.ts) defines Random world, Free flight, five generated themes, 72 fixed catalog identities and Daily/Weekly/Monthly Ops. `resolveCourseDefinition` adapts the fixed missions and Ops to generated terrain while retaining mission settings. Fixed catalog identity does not mean a fixed landscape: migrated non-Ops entries resolve with a fresh world seed unless explicitly replayed. [LegacyMissionGenerator.ts](../../src/systems/LegacyMissionGenerator.ts) preserves mission identity, modifiers and separate route/landscape revisions.

[MissionPickerLayout.ts](../../src/ui/MissionPickerLayout.ts) features Free flight, Training orbit, Daily challenge, Contour circuit and Weather approach. Weekly and Monthly are hidden from browsing, with explicit replays retained. [CoursePicker.ts](../../src/ui/CoursePicker.ts) handles search, filters, favorites and selection. Selecting a card prepares a mission; launch is separate. There is no career-rank mission unlock gate in this selection path.

[CourseBriefing.ts](../../src/ui/CourseBriefing.ts), especially `courseSortieGoal`, already derives a first completion, next medal, time-record or exploration target from existing records. [FlightBriefing.ts](../../src/core/FlightBriefing.ts) provides control-aware takeoff and milestone hints, with Training hints retained through their milestones. These are existing guidance, not proposed new features.

[Mission.ts](../../src/systems/Mission.ts) owns route generation and ordered gate acceptance. [ChallengeRun.ts](../../src/systems/ChallengeRun.ts) tracks `ready`, `running`, `returning`, `complete` and `failed`. Movement above 5 m/s starts the run clock. Passing the last gate switches to returning; a qualifying landing finalizes a scored run. A missed-gate event can affect a contract without immediately ending the mission. [main.ts](../../src/main.ts) connects gates, nitro refills, actual collision/contact, landing assessment, results and retry. Free flight remains unscored and can land and take off again without ending.

### Scoring, records and progression

[ChallengeRun.ts](../../src/systems/ChallengeRun.ts), `scoringWeightsForFocus` and `finishLanding`, combines gate precision, elapsed time and landing quality. Balanced weighting is 20,000 gate points, 70,000 time points and 10,000 landing points; gates, pace and landing focuses use different weights. Time loses 320 points per second beyond the route allowance, with a focus-specific floor. Existing bounded bonuses include rolls, combos, fuel, completion streaks, approach, weather/night, altitude, deadstick landing, destinations, biome survey and contracts/chains. The total ceiling is 117,500. Bronze starts at 64,000, silver at 76,000 and gold at 88,000. The flight preview excludes payouts gated on touchdown. Crash/ditch debriefs award no score or medal payout.

The same file stores local best scores, completion history, best complete-circuit time, badges, precision streaks and gate traces. [GhostReplay.ts](../../src/systems/GhostReplay.ts) commits the ghost on a new best score, so the ghost is not necessarily the fastest-time run. [CourseLibrary.ts](../../src/systems/CourseLibrary.ts), `courseRunId` and `courseSessionId`, and [FlightRevision.ts](../../src/core/FlightRevision.ts) separate flight, landscape, route, mission and period identities through the existing record scheme.

[CourseRecordRetention.ts](../../src/core/CourseRecordRetention.ts) bounds seeded generated/custom families to 12, and current-flight Ops history to 14 daily, eight weekly and six monthly periods, protecting active/replay identities where supplied. Older flight-revision records are retained outside current-revision pruning. These limits mean generated-world records are not a permanent all-seed career archive.

[ChallengeRun.ts](../../src/systems/ChallengeRun.ts), `courseMasteryTierForProgress`, derives Rookie through Legend from completions, score, badges, contract wins and landing quality. [CareerProgression.ts](../../src/systems/CareerProgression.ts) derives Cadet through Legend plus six commendations from aggregate records. There is no separate XP balance, purchase economy or unlock tree.

Important integration finding: `refreshCourseProgress` in [main.ts](../../src/main.ts) aggregates only resolved entries with non-null seed and profile. Migrated non-Ops entries now resolve with null seed, and generated theme entries also have null seed. Their per-seed progress is therefore excluded from that career aggregation path; current resolved Ops entries remain eligible. The displayed career should not be described as a lifetime aggregate of every flown mission. This is a code-path finding, not an approved fix or a measured player impact.

### Ops and debrief

[CourseLibrary.ts](../../src/systems/CourseLibrary.ts) derives shared Daily UTC dates, ISO weeks and UTC months, with deterministic period seeds/profiles. [CourseSession.ts](../../src/core/CourseSession.ts) captures immutable active mission, period and record identity. Catalog time may refresh, but an active run and same-course retry retain their captured identity. [OpsStreak.ts](../../src/core/OpsStreak.ts) advances once per successful period, ignores duplicate advances and prevents historical replays from rewinding a later streak.

The Daily countdown in [MissionPickerLayout.ts](../../src/ui/MissionPickerLayout.ts) targets midnight EST, fixed UTC-5, while actual generation and records still rotate on UTC. This mismatch is existing deferred work, not permission to change period semantics.

[RunResults.ts](../../src/ui/RunResults.ts) presents medal or failure, score components, landing feedback, contracts, personal-best comparisons, mastery and career outcomes. [main.ts](../../src/main.ts), the retry and choose-mission handlers, retries the captured course or returns to selection with progress retained. The result already contains many metrics. Prioritizing them is a design question, not proof that another progression system is needed.

## 3. Progression proposal

Subject to separate Daniel approval, start by clarifying existing medals, course mastery and career rank. Keep all currently browsable missions accessible. Decide explicitly whether progression should describe a particular seed, a mission identity across seeds, or only the current eligible record set. Do not silently present bounded per-seed storage as lifetime progress.

Recommendation: settle aggregation semantics in writing before changing rank targets or adding locks. Reuse existing records wherever feasible. If a chosen lifetime interpretation cannot be supported by retained data, return for a narrower design or explicit save-change approval. This plan approves neither save changes nor a replacement ledger.

## 4. Scoring proposal

Subject to separate Daniel approval, make the existing gate/time/landing breakdown and touchdown requirement easier to understand before considering numerical changes. State scoring focus and the next attainable goal consistently across briefing and debrief. Keep bonuses visible as secondary contributions rather than implying that the in-flight preview is the final total.

Recommendation: retain weights, medal thresholds, bonus rules and the ceiling for the first possible presentation phase. A later rebalance would need explicit numerical choices, sample outcomes and a compatibility decision through the existing revision scheme before coding. No new record system is proposed.

## 5. Mission-flow proposal

Each item is a candidate design direction requiring separate Daniel approval:

- Briefing: prioritize the existing primary objective, conditions, takeoff controls and one current target. Keep launch explicit and preserve keyboard/gamepad access.
- Flight: use Daniel's approved 15 to 100 ordered gates (October 22, 2026), nitro refills, home-runway return and landing completion. Use existing navigation, instruments and guidance. Preserve Free flight's open, unscored loop.
- Debrief: prioritize completion/failure, medal and score comparison, landing feedback, then the current next target; keep detailed existing metrics available. Retain retry and choose-mission actions.
- Ops rotation: retain captured active/retry identities, deterministic shared periods and historical replay. Resolve countdown wording versus reset semantics before touching either.
- Records: retain the distinction between best score, fastest complete circuit, gate splits and best-score ghost. Preserve current family bounds and historical compatibility.

## 6. What could change and what stays

Only approved documentation changes ship in 10.994. Possible later changes are limited to separately approved presentation, progression semantics or scoring decisions described here. No mission type, theme, system, feature or additional roadmap item is authorized by listing an option.

Hard limits for every later proposal:

- Preserve b20 flight physics and b21 nitro tuning, including dry handling and gate refill behavior.
- Preserve the b24 desynchronized WebGL presentation/stutter fix at 10.978 and the 10.989 frame-spike fixes. Retain the 10.990 evidence limitation: a sustained spike-count reduction remains unproven.
- Preserve b28 mission polish at 10.991 through 10.993: mission identities, valid gates/spawns and corrected theme mappings/presentation.
- Keep exactly the existing five themes and the existing terrain/worker pipeline, collision, water and resource budgets.
- Heap target remains about 200 MB. No heap chase.
- City/roads redesign remains CLOSED at 10.942.
- No weapons, combat, multiplayer, parallel record systems or parallel world systems. No Discord integration.
- No warning strip or its alerts, tones, evaluators/probes or styling. No vegetation/props or their streaming infrastructure. No blackout/redout veils, banners or associated G-load tones. These removed systems remain excluded, not future phases.
- Preserve instruments, altitude and load-factor telemetry, G readout, scoring, flight physics, terrain/obstacle collisions and ordinary navigation/glide guidance.

## 7. Candidate phases and rough cost

These are scoping alternatives inside step 4, not approved work items. Every phase and every design choice needs separate approval from Daniel before any code is written. Approval of one phase never authorizes the next. Stop after each approved delivery and its required verification.

A three-part batch like b28 is the reference: about one b28 means comparable Codex effort including review, checks and evidence, not a measured token or weekly-quota prediction. Estimates are deliberately broad; integration or compatibility findings can increase them.

| Candidate phase | Rough size and boundary | Rough Codex cost |
| --- | --- | --- |
| P0: decision specification | Small docs follow-up recording Daniel's selected options, acceptance examples and exclusions. No code. | About one quarter of a b28. |
| P1: briefing/debrief clarity | Small to medium, one or two coherent parts using existing goals and result data. No scoring or persistence changes. | About one half to one b28. |
| P2: progression consistency | Medium to large, two or three parts only after aggregation and historical-data choices are approved. Reuse existing records; pause if those cannot meet the chosen design. | About one to two b28s. |
| P3: scoring clarity or rebalance | Clarity only: small, possibly folded into P1 if explicitly approved. Numerical rebalance: medium to large, two or three parts including compatibility and outcome checks. | About one half b28 for clarity, or about one to two b28s for rebalance. |
| P4: approved-scope integration proof | Medium, targeted mission completion/retry, Ops-boundary and record-compatibility checks for the actual changes. Keep browser/performance work proportionate to affected behavior. | About one b28; broader approved numeric changes may cost more. |

Recommendation: consider P0, then P1, then reassess. Do not commission all phases as a bundle. P2 and numerical P3 are optional, and clarity work must not be counted twice. With about 4% weekly Codex usage left and no banked resets, this batch ends after the docs delivery; these estimates are not a claim that implementation fits the remaining budget.

## 8. Risks and future acceptance boundaries

- Aggregating fresh seeds can inflate progression or lose it when bounded families expire. Require explicit examples covering replay, pruning, old revisions and current-period Ops before approving P2.
- Rank and mastery threshold changes could demote existing pilots. Choose historical treatment first; never erase or reinterpret old records silently.
- Score/bonus changes can invalidate medal comparisons and best-score ghosts. Require a single compatible identity/revision policy in the existing record scheme.
- Reset-time changes can shift shared periods and replay identities. Wording-only correction is smaller than changing the clock contract.
- A larger briefing/debrief can hide launch or retry on short windows or disrupt keyboard/gamepad flow. Any later UI phase needs focused interaction and layout checks.
- Extra per-frame progression or UI work can regress preserved stutter fixes. Favor existing event-driven data paths; do not reopen heap or infrastructure optimization.
- This audit establishes code behavior, not mission balance or player comprehension. No new balance, performance or manual-flight acceptance is claimed.

For any later approved code phase, agree focused tests, production build and relevant browser/flight evidence with its scope. Do not schedule full-catalog flights, long simulations or a broad audit by default. For this docs-only batch, use CI-required checks and the AGENTS.md production build; no browser check or manual flight is needed.

## 9. Open design choices for Daniel

Every option remains unapproved until Daniel chooses it and separately approves the phase that would implement it. Recommendations confer no authorization.

1. **Overhaul emphasis.** A: clarify the existing loop and presentation. B: prioritize progression consistency. C: prioritize numerical scoring rebalance. Recommendation: A, because it limits compatibility risk while making the existing game clearer.
2. **Progression meaning.** A: describe only records currently retained and eligible. B: aggregate retained seed records by mission identity, accepting pruning effects. C: pursue lifetime mission progress only after separately approving a feasible data design within the existing record system. Recommendation: A initially, with the career coverage limitation made explicit; choose B or C only after concrete examples.
3. **Unlocks.** A: keep all browsable missions open. B: recommend an order using existing progress without blocking access. C: gate existing missions by achievement. Recommendation: A; B and C are additional design changes and require their own approval, including any historical treatment.
4. **Scoring.** A: retain all current numbers and explain them. B: adjust only core gate/time/landing weights and medal thresholds after approving exact values. C: also reconsider existing bonus stacking and the cap. Recommendation: A first; B and C need separate balance and record-compatibility approval.
5. **Briefing and debrief density.** A: retain current layout and improve wording. B: prioritize one goal and outcome, with existing details secondary. C: retain presentation as is. Recommendation: B if a UI phase is approved; settle exact visible content before coding.
6. **Ops clock.** A: align countdown wording/display with the existing UTC reset. B: change actual reset to fixed EST, with an approved period/replay compatibility specification. C: retain current behavior and explicitly disclose the display/reset mismatch. Recommendation: A, since it preserves shared period identity. No option changes the clock in this batch.
7. **Weekly/Monthly visibility.** A: keep hidden browsing and historical replay support. B: restore browse access to the existing modes. C: show historical entries only in existing replay context. Recommendation: A; no rotation expansion or new mode is proposed.
8. **Record compatibility if scoring changes.** A: avoid incompatible scoring changes and retain identities. B: use the existing revision mechanism, retain old families and distinguish comparisons. C: narrow the approved change until existing identities stay comparable. Recommendation: A for clarity work, B only if an incompatible rebalance is separately approved; no parallel ledger.
9. **First possible implementation scope.** A: approve only P0 decision documentation next. B: approve a precisely bounded P1 after selecting its content. C: defer step 4 entirely. Recommendation: A under the current budget. None is selected by this plan.

10.994 ends at this plan, synchronized release metadata and CI confirmation. STOP. No implementation follows without Daniel's separate approval of every phase and design choice.
