# Full In-App Round Administration Design

## Goal

Make Apex playable end to end without requiring a facilitator to edit Dataverse
records directly. Administrators configure rounds and scoring, control the live
simulation, and explicitly advance between events. Rostered members collaborate
on one shared submission per team.

Team and user rosters remain seeded for this release. The application has two
behavioral roles:

- **Admin** manages rounds, scoring configuration, and the live simulation.
- **Member** belongs to one seeded team and can submit that team's allocation.

The existing `mw_iscaptain` field remains for compatibility but no longer grants
special application behavior.

## Chosen Approach

Extend the existing round model. Do not introduce separate round templates and
round instances yet.

Pending rounds are editable. Opening a round freezes its event, budget,
categories, ordering, and assigned scoring configuration. The enforced lifecycle
remains:

```text
Pending -> Open -> Locked -> Revealed
```

After reveal, the administrator explicitly activates another Pending round by
updating the active simulation's current-round lookup. When no rounds remain,
the administrator can complete the simulation.

## Admin Experience

The Admin Console has three sections.

### Live Run

- Show the current round and per-team submission status.
- Open a valid Pending round.
- Lock a round after all teams submit.
- Offer an explicitly confirmed force lock when teams are missing.
- Reveal results using the round's immutable scoring configuration.
- Activate a selected Pending round after the current round is Revealed.
- Complete the simulation when no Pending rounds remain.

### Rounds

- Create, edit, reorder, and delete Pending rounds.
- Edit event key, event title, event description, budget, and display order.
- Add, edit, reorder, and remove round-scoped categories.
- Assign a Published scoring configuration.
- Show immutable read-only summaries for Open, Locked, and Revealed rounds.

Round validation requires:

- a unique positive round order;
- a nonempty event key and title;
- a positive finite budget;
- at least one category;
- unique nonempty stable category keys within the round; and
- a Published scoring configuration that covers every event/category pair.

### Scoring

- Show Published and Retired configuration summaries.
- Clone a Published configuration into a new Draft version.
- Edit the system-health baseline, event/category weight matrix, and Red,
  Yellow, and Green thresholds.
- Validate and save Draft configurations.
- Publish a valid Draft, making it immutable.
- Retire old Published configurations without changing historical rounds.

Publishing validates coverage for every event/category pair currently configured
in the simulation. A later round introducing new pairs requires a new
configuration version before that round can open.

## Member Experience

Any rostered member of a team has the same capabilities.

- **Pending:** show the event preview without allocation controls.
- **Open and unsubmitted:** show the allocation form.
- **Open and submitted:** show the immutable winning team submission.
- **Locked:** show a waiting-for-reveal state.
- **Revealed:** show a result summary and link to the full dashboard.

Members edit locally until submission. Values must be finite, nonnegative, cover
the round's exact category set, and sum to the round budget. The first successful
team submission wins and locks the team. A later stale attempt reloads and shows
the winning submission.

## Authoritative Team Submission

The existing per-category allocation rows cannot atomically enforce first-writer
semantics because the generated Power Apps client performs separate record
writes. Add an `mw_teamsubmission` table as the authoritative scoring input.

Required columns:

- name;
- Round lookup;
- Team lookup;
- allocation payload JSON;
- submitted-at timestamp; and
- submitted-by user reference.

An alternate key on Round and Team permits exactly one record per team/round.
Dataverse therefore arbitrates concurrent member submissions atomically.

The allocation JSON contains category IDs and amounts. The winning submission is
the scoring source of truth. Existing `mw_allocation` rows remain available for
reporting and can be synchronized after the authoritative submission succeeds.

Admin submission monitoring reads `mw_teamsubmission`, not a collection of
allocation timestamps.

## Round Data and Ordering

Add `mw_displayorder` to `mw_category`. Round order continues to use
`mw_round.mw_index`.

Round creation and editing use stable keys and idempotent reconciliation because
the generated client does not expose a multi-record transaction. If category or
allocation initialization fails, the round remains Pending and the administrator
can safely retry.

Opening a round:

1. Re-read the simulation, round, and assigned Config Set.
2. Confirm the round is the simulation's current Pending round.
3. Validate round fields, categories, and complete scoring coverage.
4. Ensure one reporting allocation row exists for every team/category pair.
5. Change the round status to Open.

Activating the next round is allowed only after the current round is Revealed.
It updates `mw_simulation.mw_currentroundid`; it does not open the round
automatically.

## Scoring and Reveal

Locking normally requires an authoritative submission from every team. Force
Lock requires confirmation and clearly identifies missing teams. Missing teams
do not receive manufactured allocations and cannot be scored unless an explicit
product rule is added later.

Reveal:

1. Re-read the Locked round and immutable Config Set.
2. Load authoritative team submissions.
3. Validate team, category, and budget integrity.
4. Fail if any required team submission is missing.
5. Load the persisted weights and health bands.
6. Score each team and idempotently create its round result.
7. Mark the round Revealed after all results exist.

Scoring fails closed when persisted configuration is missing, corrupt, or
unavailable. Built-in weights are never used for a scoring write. Read-only
historical dashboards may use fallback display bands with a visible warning.

## Services and UI Boundaries

- `RoundAdminService` owns Pending round/category CRUD, ordering, activation, and
  simulation completion.
- `ConfigurationAdminService` owns Draft cloning, editing, validation,
  publishing, and retirement.
- `TeamSubmissionService` owns first-writer submission, winner loading, and
  reporting-allocation synchronization.
- The existing round lifecycle service owns Open, Lock, and Reveal transitions.
- React hooks adapt these services into Admin and Member screen state.

Generated Dataverse models and services remain isolated behind domain mappers and
the service boundaries above.

## Error Handling and Concurrency

- Every state-changing command re-reads persisted state before writing.
- Stale round, configuration, or submission snapshots fail with a conflict
  message and trigger a refresh.
- Alternate keys prevent duplicate rounds/categories where applicable,
  duplicate configuration rows, duplicate results, and duplicate team
  submissions.
- Partial setup operations remain Pending and retryable.
- Controls remain disabled while a command is running.
- Load, validation, conflict, and Dataverse failures appear in accessible inline
  alerts with retry actions.
- Destructive Pending-round deletion requires explicit confirmation.

## Security

Dataverse security remains the enforcement boundary.

- Admins receive CRUD access to simulation configuration, rounds, categories,
  submissions, scoring configuration, and results.
- Members receive read access to the active simulation and configuration needed
  for play, plus create/read access scoped to their team's submission data.
- UI role resolution maps a roster record without a team to Admin and a roster
  record with a team to Member.
- Unrostered users fail closed.

The seeded roster remains the setup mechanism for this release.

## Testing and Verification

Implementation follows test-driven development.

- Pure unit tests cover round validation, configuration validation, legal state
  transitions, exact-budget rules, and submission payload integrity.
- Dataverse adapter tests cover lookup casing, normalized GUIDs, alternate-key
  conflicts, mapping, and idempotent retries.
- Component tests cover all Admin and Member states, confirmations, disabled
  controls, stale submissions, and accessible errors.
- Full verification runs the complete test suite, lint, TypeScript/Vite build,
  and `git diff --check`.
- Hosted acceptance exercises:
  create round -> publish configuration -> activate -> open -> submit for each
  team -> lock -> reveal -> activate next round.

The large Vite bundle warning is nonblocking for this release but should be
tracked as later performance work.
