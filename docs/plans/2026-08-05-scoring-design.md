# Provisional Scoring Design

## Decision

Keep the current weighted-allocation scoring behavior as a temporary,
stakeholder-replaceable assumption. The Admin Console remains the tuning
surface: administrators edit event/category weights in a versioned scoring
configuration, publish it, and assign it to a round.

The provisional formula is:

```text
category impact = allocation / round budget * event/category weight * 20
round delta = sum(category impact)
new health = clamp(previous health + round delta, 0, 100)
```

The scale of `20` is not derived from the number of categories. It is a
temporary calibration constant that produces an approximately 20-point change
when the full budget is allocated and the effective weight averages to 1.

## Architecture and data flow

- Keep `scoreRound` as a pure TypeScript function with its existing
  `ScoringInput` and `ScoringResult` contracts.
- Extract `20` into a named constant in `ScoringEngine.ts` and document it as a
  provisional assumption.
- Continue loading weights from the published Dataverse configuration through
  the existing round lifecycle.
- Do not add Dataverse columns, configuration fields, or new Admin Console
  controls until the stakeholder formula is available.

## Compatibility and error handling

Preserve current behavior:

- Missing category weights continue to default to `1.0`.
- Health remains clamped to `0-100`.
- Contributions are rescaled only when clamping changes the final delta so
  displayed contributions reconcile to the applied delta.
- Existing configuration validation and fail-closed loading behavior remain
  unchanged.

## Testing

Retain the existing scoring tests and add regression coverage that locks the
temporary assumption:

- Full-budget allocation with a neutral weight produces a 20-point delta.
- Weight changes scale category impact linearly.
- Negative weights reduce health.
- Existing clamping and contribution reconciliation remain unchanged.

## Replacing the assumption

When stakeholders provide the approved formula, replace the isolated scale and
formula implementation in `ScoringEngine.ts`, update the scoring tests and
configuration semantics as needed, and preserve the public scoring contract
unless the approved model requires a deliberate contract change.
