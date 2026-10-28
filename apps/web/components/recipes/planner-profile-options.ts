export const PLANNER_RECIPE_TYPE_OPTIONS = [
  { key: "main", label: "Main" },
  { key: "side", label: "Side" },
  { key: "soup", label: "Soup" },
  { key: "salad", label: "Salad" },
  { key: "breakfast", label: "Breakfast" },
  { key: "snack", label: "Snack" },
  { key: "dessert", label: "Dessert" },
  { key: "drink", label: "Drink" },
  { key: "condiment", label: "Condiment" },
  { key: "sauce", label: "Sauce" },
  { key: "starter", label: "Starter" },
  { key: "bake", label: "Bake" },
] as const;

export const SUITABLE_SLOT_OPTIONS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "mid-morning", label: "Mid-Morning" },
  { key: "lunch", label: "Lunch" },
  { key: "afternoon", label: "Afternoon" },
  { key: "dinner", label: "Dinner" },
  { key: "evening", label: "Evening" },
  { key: "snack", label: "Snack" },
  { key: "pre-workout", label: "Pre-Workout" },
  { key: "post-workout", label: "Post-Workout" },
] as const;

export function formatPlannerProfileValue(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
