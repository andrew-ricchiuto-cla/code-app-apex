# Versioned Dataverse Configuration Design

## Goal

Let a business owner manage scoring weights, the system-health baseline, and Red/Yellow/Green thresholds from the Apex Admin Console without requiring code changes or deployments.

## Configuration Model

Configuration is versioned so edits cannot change an open or revealed round.

### `mw_configset`

- Name and version identify the configuration.
- Status is `Draft`, `Published`, or `Retired`.
- System Health Baseline is configurable from 0 through 100.
- Published At records when the version became immutable.

### `mw_weight`

- Looks up to one Config Set.
- Event Key matches `mw_round.mw_eventkey`.
- Category Key matches `mw_category.mw_key`.
- Weight is a configurable decimal.
- An alternate key on Config Set, Event Key, and Category Key prevents duplicates.

### `mw_healthband`

- Looks up to one Config Set.
- Label is one of Red, Yellow, or Green.
- Minimum Score defines the inclusive lower bound.
- Color is a controlled Red, Yellow, or Green value used to map to application styling.
- Display Order controls presentation.
- An alternate key on Config Set and Label prevents duplicates.

### Round Configuration

`mw_round` receives a Config Set lookup. A round may select only a Published configuration. The reference becomes immutable when the round opens. The existing `mw_weightsconfig` JSON record remains temporarily for migration and rollback but is no longer the primary runtime source.

## Administration Flow

The Admin Console adds a Configuration section that shows the current published version and supports:

1. Creating a Draft by cloning a Published configuration.
2. Editing the baseline, event/category weight grid, and Red/Yellow/Green thresholds.
3. Validating that every required event/category combination has one finite weight.
4. Validating ordered, non-overlapping thresholds within 0 through 100, with Red beginning at 0.
5. Publishing the Draft, making it immutable.
6. Selecting a Published Config Set for a pending round.

The initial migration creates `Apex Baseline v1` from the current assumed weights and thresholds of Red 0, Yellow 40, and Green 70. All seeded rounds are attached to it.

## Runtime Data Flow

Scoring loads `mw_weight` rows through the round's locked Config Set. Reveal views load `mw_healthband` rows from the same Config Set, ensuring that scores and labels use one version.

Code defaults remain an emergency fallback. If Dataverse configuration cannot be read or is invalid, the application uses the defaults and shows a visible configuration warning.

## Safety and Concurrency

- Published configurations are immutable in application behavior.
- Draft changes never affect active rounds.
- Alternate keys prevent duplicate weights and health bands.
- Publish validation rejects incomplete or overlapping configuration.
- Round opening rejects a missing or non-Published Config Set.
- A round's Config Set reference cannot change after opening.
- Concurrent publish operations re-read the Config Set and fail cleanly if another action already published it.

## Testing and Verification

Tests cover draft cloning, validation, publishing, immutable Published versions, row mapping, scoring, band classification, round locking, fallback warnings, and Admin Console behavior. Deployment verification includes idempotent schema reconciliation and seeding, solution export, generated data-source refresh, full tests, lint, production build, and PAC deployment.
