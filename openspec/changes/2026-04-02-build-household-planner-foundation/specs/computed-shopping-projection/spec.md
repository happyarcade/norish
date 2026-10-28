## ADDED Requirements

### Requirement: Shopping is computed from planner and prep data
The shopping system SHALL derive purchase needs from plan slots and prep sessions instead of treating generic grocery rows as the primary source of meal-planning truth.

#### Scenario: Planned meals generate shopping projection
- **WHEN** a household has planned meals and scheduled prep sessions in the selected window
- **THEN** the system SHALL compute shopping quantities from those records
- **AND** the projection SHALL account for slot roles, batch scaling, and prep production

### Requirement: Shopping horizon is configurable and planner-specific
The shopping system SHALL use its own configurable window rather than inheriting the planner view horizon.

#### Scenario: Household uses default shopping window
- **WHEN** a household first opens shopping
- **THEN** the shopping horizon SHALL default to a 28-day window anchored to the current planning week

### Requirement: Shopping projection preserves lifecycle behavior
The shopping system SHALL distinguish stable and perishable items so the shopping list can aggregate long-life ingredients differently from week-bound perishables.

#### Scenario: Stable items are pulled forward
- **WHEN** a multi-week shopping window contains pantry-stable items used across multiple weeks
- **THEN** those items SHALL be aggregated into the current shopping window
- **AND** week-bound perishables SHALL remain anchored to their own week

### Requirement: Computed shopping can feed checklist workflows
The system SHALL allow computed shopping results to be projected into checklist-oriented grocery workflows without making manual grocery rows the planner source of truth.

#### Scenario: Projection feeds grocery checklist
- **WHEN** a household wants to shop from computed planner output
- **THEN** the system MAY materialize shopping projection items into checklist-oriented grocery records
- **AND** the planner-derived projection SHALL remain the authoritative computation source
