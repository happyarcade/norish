## ADDED Requirements

### Requirement: Imported recipe sources are stored separately from canonical recipes
The system SHALL preserve raw imported recipe payloads separately from canonical recipes so source provenance, scraper output, and reprocessing remain available after import.

#### Scenario: Raw source payload is retained after import
- **WHEN** a user imports a recipe from a schema.org-style JSON payload or scraped recipe source
- **THEN** the raw imported data SHALL be stored in a dedicated source record
- **AND** the canonical recipe SHALL reference that source record

### Requirement: Canonical recipes preserve both raw ingredient lines and normalized ingredients
The system SHALL preserve original ingredient text while also storing normalized ingredients for filtering, display, unit conversion, and downstream planner/shopping logic.

#### Scenario: Import stores both ingredient representations
- **WHEN** a recipe is imported
- **THEN** the original ingredient lines SHALL remain queryable
- **AND** normalized ingredient rows with parsed amounts and units SHALL be stored for the canonical recipe

### Requirement: Planner metadata is stored as structured enrichment
The system SHALL store planner-relevant recipe metadata in structured fields rather than relying on generic categories or free-text tags.

#### Scenario: Recipe stores planner profile separately from tags
- **WHEN** a recipe is created or imported
- **THEN** the recipe MAY include generic discovery tags
- **AND** planner-relevant fields such as suitable slots, recipe types, divisibility, freezer friendliness, heat level, prep score, and fruit/veg count SHALL be stored in a planner profile linked to that recipe

### Requirement: Canonical import accepts schema.org-style input
The import pipeline SHALL accept recipe payloads that resemble schema.org or scraper-derived recipe JSON as the ingestion source shape.

#### Scenario: Schema.org-style payload is converted into canonical records
- **WHEN** the import pipeline receives a payload containing title, source URL, images, timings, yields, ingredients, instructions, and nutrition
- **THEN** the system SHALL map those fields into canonical recipe records and planner enrichment defaults without requiring the raw payload shape to become the final storage schema
