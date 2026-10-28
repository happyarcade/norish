# Change: Build Household Planner Foundation

## Why

Norish is a strong platform shell for recipe discovery, auth, households, imports, and long-term scale, but its current meal planning model is too thin for the richer OMM planner domain. OMM has the stronger planner, prep, and computed shopping behaviors, but it does not yet have the infrastructure maturity needed for a larger household product.

We need a Day 0 foundation that keeps Norish as the platform while rebuilding the planning domain around a richer canonical recipe model, configurable planner slots, first-class prep sessions, and computed shopping.

## What Changes

- Introduce a three-layer recipe model: raw imported recipe source, canonical recipe record, and planner-specific recipe enrichment.
- Introduce a household-first planner domain with configurable slot definitions instead of a fixed four-slot enum.
- Represent planned meals as slot records plus child slot items so mains, sides, drinks, and notes can coexist cleanly.
- Rebuild prep deck as persisted prep sessions rather than client-only day buckets.
- Treat shopping as a computed projection from planner and prep data, with Norish groceries remaining an optional checklist output layer.
- Preserve Norish's strong month/calendar visibility while adding OMM-style day and week planning surfaces.

## Impact

- Affected specs: `recipe-ingestion-foundation`, `household-planner-domain`, `computed-shopping-projection`
- Affected code: `packages/db`, `packages/shared`, `packages/api`, `packages/trpc`, `apps/web/app/(app)/calendar`, recipe import pipeline, groceries projection flows
