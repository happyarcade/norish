import { relations } from "drizzle-orm";

import { users } from "./auth";
import { groceries } from "./groceries";
import { householdPeople } from "./household-people";
import { householdPlannerProfiles } from "./household-planner-profiles";
import { householdUsers } from "./household-users";
import { households } from "./households";
import { ingredients } from "./ingredients";
import { planSlotItems } from "./plan-slot-items";
import { planSlotPeople } from "./plan-slot-people";
import { planSlots } from "./plan-slots";
import { plannerSlotDefinitions } from "./planner-slot-definitions";
import { prepSessionItems } from "./prep-session-items";
import { prepSessions } from "./prep-sessions";
import { recipeImages } from "./recipe-images";
import { recipeImportReviews } from "./recipe-import-reviews";
import { recipeIngredients } from "./recipe-ingredients";
import { recipeCookEvents } from "./recipe-cook-events";
import { recipePlannerProfiles } from "./recipe-planner-profiles";
import { recipeRatings } from "./recipe-ratings";
import { recipeSources } from "./recipe-sources";
import { recipeTags } from "./recipe-tags";
import { recipeVideos } from "./recipe-videos";
import { recipes } from "./recipes";
import { serverConfig } from "./server-config";
import { stepImages } from "./step-images";
import { steps } from "./steps";
import { ingredientStorePreferences, stores } from "./stores";
import { tags } from "./tags";
import { userAllergies } from "./user-allergies";

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
  recipeTags: many(recipeTags),
  steps: many(steps),
  ratings: many(recipeRatings),
  images: many(recipeImages),
  videos: many(recipeVideos),
  sources: many(recipeSources),
  plannerProfiles: many(recipePlannerProfiles),
  importReviews: many(recipeImportReviews),
  cookEvents: many(recipeCookEvents),
  planSlotItems: many(planSlotItems),
  prepSessionItems: many(prepSessionItems),
}));

export const recipeSourcesRelations = relations(recipeSources, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeSources.recipeId],
    references: [recipes.id],
  }),
}));

export const recipePlannerProfilesRelations = relations(recipePlannerProfiles, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipePlannerProfiles.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeImportReviewsRelations = relations(recipeImportReviews, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeImportReviews.recipeId],
    references: [recipes.id],
  }),
  reviewedByUser: one(users, {
    fields: [recipeImportReviews.reviewedBy],
    references: [users.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
  userAllergies: many(userAllergies),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  recipeIngredients: many(recipeIngredients),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipeIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

export const stepsRelations = relations(steps, ({ one, many }) => ({
  recipe: one(recipes, {
    fields: [steps.recipeId],
    references: [recipes.id],
  }),
  images: many(stepImages),
}));

export const stepImagesRelations = relations(stepImages, ({ one }) => ({
  step: one(steps, {
    fields: [stepImages.stepId],
    references: [steps.id],
  }),
}));

export const recipeImagesRelations = relations(recipeImages, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeImages.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeVideosRelations = relations(recipeVideos, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeVideos.recipeId],
    references: [recipes.id],
  }),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(householdUsers),
  plannerProfiles: many(householdPlannerProfiles),
  people: many(householdPeople),
  slotDefinitions: many(plannerSlotDefinitions),
  planSlots: many(planSlots),
  prepSessions: many(prepSessions),
  cookEvents: many(recipeCookEvents),
}));

export const householdUsersRelations = relations(householdUsers, ({ one }) => ({
  household: one(households, {
    fields: [householdUsers.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [householdUsers.userId],
    references: [users.id],
  }),
}));

export const householdPlannerProfilesRelations = relations(householdPlannerProfiles, ({ one }) => ({
  household: one(households, {
    fields: [householdPlannerProfiles.householdId],
    references: [households.id],
  }),
}));

export const householdPeopleRelations = relations(householdPeople, ({ one, many }) => ({
  household: one(households, {
    fields: [householdPeople.householdId],
    references: [households.id],
  }),
  linkedUser: one(users, {
    fields: [householdPeople.linkedUserId],
    references: [users.id],
  }),
  planSlotPeople: many(planSlotPeople),
}));

export const plannerSlotDefinitionsRelations = relations(plannerSlotDefinitions, ({ one, many }) => ({
  household: one(households, {
    fields: [plannerSlotDefinitions.householdId],
    references: [households.id],
  }),
  planSlots: many(planSlots),
}));

export const planSlotsRelations = relations(planSlots, ({ one, many }) => ({
  household: one(households, {
    fields: [planSlots.householdId],
    references: [households.id],
  }),
  slotDefinition: one(plannerSlotDefinitions, {
    fields: [planSlots.plannerSlotDefinitionId],
    references: [plannerSlotDefinitions.id],
  }),
  items: many(planSlotItems),
  participants: many(planSlotPeople),
}));

export const planSlotItemsRelations = relations(planSlotItems, ({ one }) => ({
  planSlot: one(planSlots, {
    fields: [planSlotItems.planSlotId],
    references: [planSlots.id],
  }),
  recipe: one(recipes, {
    fields: [planSlotItems.recipeId],
    references: [recipes.id],
  }),
}));

export const planSlotPeopleRelations = relations(planSlotPeople, ({ one }) => ({
  planSlot: one(planSlots, {
    fields: [planSlotPeople.planSlotId],
    references: [planSlots.id],
  }),
  householdPerson: one(householdPeople, {
    fields: [planSlotPeople.householdPersonId],
    references: [householdPeople.id],
  }),
}));

export const prepSessionsRelations = relations(prepSessions, ({ one, many }) => ({
  household: one(households, {
    fields: [prepSessions.householdId],
    references: [households.id],
  }),
  items: many(prepSessionItems),
}));

export const prepSessionItemsRelations = relations(prepSessionItems, ({ one }) => ({
  prepSession: one(prepSessions, {
    fields: [prepSessionItems.prepSessionId],
    references: [prepSessions.id],
  }),
  recipe: one(recipes, {
    fields: [prepSessionItems.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeCookEventsRelations = relations(recipeCookEvents, ({ one }) => ({
  household: one(households, {
    fields: [recipeCookEvents.householdId],
    references: [households.id],
  }),
  recipe: one(recipes, {
    fields: [recipeCookEvents.recipeId],
    references: [recipes.id],
  }),
  user: one(users, {
    fields: [recipeCookEvents.userId],
    references: [users.id],
  }),
  planSlotItem: one(planSlotItems, {
    fields: [recipeCookEvents.planSlotItemId],
    references: [planSlotItems.id],
  }),
  prepSessionItem: one(prepSessionItems, {
    fields: [recipeCookEvents.prepSessionItemId],
    references: [prepSessionItems.id],
  }),
}));

export const groceriesRelations = relations(groceries, ({ one }) => ({
  user: one(users, {
    fields: [groceries.userId],
    references: [users.id],
  }),
  recipeIngredient: one(recipeIngredients, {
    fields: [groceries.recipeIngredientId],
    references: [recipeIngredients.id],
  }),
  store: one(stores, {
    fields: [groceries.storeId],
    references: [stores.id],
  }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  user: one(users, {
    fields: [stores.userId],
    references: [users.id],
  }),
  groceries: many(groceries),
  ingredientPreferences: many(ingredientStorePreferences),
}));

export const ingredientStorePreferencesRelations = relations(
  ingredientStorePreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [ingredientStorePreferences.userId],
      references: [users.id],
    }),
    store: one(stores, {
      fields: [ingredientStorePreferences.storeId],
      references: [stores.id],
    }),
  })
);

export const serverConfigRelations = relations(serverConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [serverConfig.updatedBy],
    references: [users.id],
  }),
}));

export const recipeRatingsRelations = relations(recipeRatings, ({ one }) => ({
  user: one(users, {
    fields: [recipeRatings.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [recipeRatings.recipeId],
    references: [recipes.id],
  }),
}));

export const userAllergiesRelations = relations(userAllergies, ({ one }) => ({
  user: one(users, {
    fields: [userAllergies.userId],
    references: [users.id],
  }),
  tag: one(tags, {
    fields: [userAllergies.tagId],
    references: [tags.id],
  }),
}));
