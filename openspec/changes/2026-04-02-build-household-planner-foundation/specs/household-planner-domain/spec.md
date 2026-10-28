## ADDED Requirements

### Requirement: Households define configurable planner slots
The system SHALL allow each household to define and enable planner slots beyond a fixed Breakfast/Lunch/Dinner/Snack enum.

#### Scenario: Household enables richer slot set
- **WHEN** a household configures its planning structure
- **THEN** the household SHALL be able to enable primary and optional slots such as breakfast, mid-morning, lunch, afternoon, dinner, evening, pre-workout, post-workout, and multiple snack slots

### Requirement: Planned days are modeled as slots plus child items
The planner SHALL model each date as a set of slot records with child items so slot-level behavior and mixed item types remain explicit.

#### Scenario: Slot contains main, side, and drink items
- **WHEN** a user plans a dinner with a main recipe, attached side, and attached drink
- **THEN** the day SHALL contain one dinner slot record
- **AND** the dinner slot SHALL contain child items representing the main, side, and drink roles

#### Scenario: Slot-level state remains independent from child items
- **WHEN** a user locks a slot or changes its headcount override
- **THEN** that state SHALL be stored on the slot record
- **AND** the child item assignments SHALL remain independently editable

### Requirement: Planner supports month, week, and day surfaces
The planning experience SHALL provide a visible month overview plus focused week and day planning surfaces.

#### Scenario: Month view preserves visibility
- **WHEN** a user browses the planner at a monthly level
- **THEN** the UI SHALL prioritize scanability and date visibility inspired by the Norish calendar shell

#### Scenario: Week and day views support active planning
- **WHEN** a user edits a plan in week or day view
- **THEN** the UI SHALL support richer slot editing, regeneration, print/export, and meal-detail workflows than the month overview

### Requirement: Prep is a first-class planning domain
The system SHALL treat prep as a persisted planning concept rather than a client-only list attached to dates.

#### Scenario: Prep session is scheduled for a day
- **WHEN** a user schedules batch prep for a date
- **THEN** the system SHALL create a prep session with one or more prep session items
- **AND** each prep item SHALL store its recipe reference and planned batch count
