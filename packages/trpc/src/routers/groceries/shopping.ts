import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import {
  buildShoppingProjection,
  DEFAULT_SHOPPING_WINDOW_DAYS,
  thisMondayISO,
} from "@norish/db/repositories/shopping-projection";
import {
  ShoppingProjectionDayCountSchema,
  ShoppingProjectionInputSchema,
  ShoppingProjectionResponseSchema,
} from "@norish/shared/contracts/zod";
import { partitionShoppingProjectionForPantry } from "@norish/shared/lib/shopping-pantry";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

const projection = authedProcedure
  .input(ShoppingProjectionInputSchema.optional())
  .query(async ({ ctx, input }) => {
    const dayCount = ShoppingProjectionDayCountSchema.parse(
      input?.dayCount ?? DEFAULT_SHOPPING_WINDOW_DAYS
    );
    const windowStart = input?.windowStart ?? thisMondayISO();

    if (!ctx.household?.id) {
      return ShoppingProjectionResponseSchema.parse({
        hasHousehold: false,
        householdId: null,
        householdPortionUnits: 0,
        activePeopleCount: 0,
        dayCount,
        windowStart,
        windowEnd: addDays(windowStart, dayCount - 1),
        stableItems: [],
        currentWeekItems: [],
        upcomingWeeks: [],
        pantryItems: [],
        pantryItemCount: 0,
        totalItemCount: 0,
      });
    }

    const [projection, pantry] = await Promise.all([
      buildShoppingProjection({
        householdId: ctx.household.id,
        dayCount,
        windowStart,
      }),
      listPantryIngredientsByUserIds(ctx.userIds),
    ]);

    return ShoppingProjectionResponseSchema.parse(
      partitionShoppingProjectionForPantry(projection, pantry)
    );
  });

export const shoppingProjectionProcedures = router({
  projection,
});
