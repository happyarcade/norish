## 1. Schema and Contracts

- [ ] 1.1 Add a raw `recipe_sources` ingestion model for schema.org-style payloads and scraped provenance.
- [ ] 1.2 Extend the canonical recipe model to support normalized nutrition, tags, cuisine, and source metadata without hard-coding planner behavior into generic categories.
- [ ] 1.3 Add a `recipe_planner_profiles` model for structured planner metadata such as suitable slots, recipe types, divisibility, freezer friendliness, heat level, prep score, and fruit/veg count.
- [ ] 1.4 Add `household_planner_profiles` and `planner_slot_definitions` so households can configure day/week planning behavior beyond Breakfast/Lunch/Dinner/Snack.
- [ ] 1.5 Add `plan_slots` and `plan_slot_items` to model slot-level state plus main/side/drink/note children.
- [ ] 1.6 Add `prep_sessions` and `prep_session_items` as the persisted replacement for the current lightweight prep deck.

## 2. Import Pipeline

- [ ] 2.1 Map schema.org-style and scraped recipe JSON into `recipe_sources` and canonical `recipes`.
- [ ] 2.2 Preserve original ingredient lines alongside normalized ingredients and units.
- [ ] 2.3 Populate `recipe_planner_profiles` during import with defaultable structured fields and lightweight manual enrichment support.
- [ ] 2.4 Ensure imported recipes remain editable without losing source provenance.

## 3. Planner and Prep Domain

- [ ] 3.1 Build repository and API support for configurable household slots and date-based plan slots.
- [ ] 3.2 Support slot-level states such as lock, keep/swap status, headcount override, and batch multiplier.
- [ ] 3.3 Support child slot items for mains, sides, drinks, and notes.
- [ ] 3.4 Build prep session CRUD and link prep output to future plan consumption.

## 4. UI Surfaces

- [ ] 4.1 Preserve Norish-style month visibility as the planner shell.
- [ ] 4.2 Add a day view optimized for focused editing and meal detail.
- [ ] 4.3 Add a week view optimized for active planning, regeneration, and print/export.
- [ ] 4.4 Add a first-class prep surface that feels native to the planner rather than bolted on.

## 5. Computed Shopping

- [ ] 5.1 Rebuild shopping from plan slots plus prep sessions rather than generic grocery rows.
- [ ] 5.2 Support configurable shopping windows with a 28-day default and week-anchored horizon.
- [ ] 5.3 Preserve stable vs perishable lifecycle behavior and planner-derived quantities.
- [ ] 5.4 Decide which shopping projections should also materialize into Norish groceries for checklist interactions.

## 6. Validation

- [ ] 6.1 Validate schema relationships and repository boundaries in `packages/db` and `packages/api`.
- [ ] 6.2 Validate import fidelity using representative schema.org-style recipes.
- [ ] 6.3 Validate planner flows for month, week, day, and prep views.
- [ ] 6.4 Validate shopping projections against OMM behavior for horizons, prep, and batch scaling.
