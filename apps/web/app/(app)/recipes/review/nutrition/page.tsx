import NutritionReviewPage from "@/components/recipes/nutrition-review-page";

type RecipeNutritionReviewRouteProps = {
  searchParams: Promise<{ search?: string | string[] }>;
};

export default async function RecipeNutritionReviewRoute({
  searchParams,
}: RecipeNutritionReviewRouteProps) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim().slice(0, 120) : "";

  return <NutritionReviewPage initialSearch={search} />;
}
