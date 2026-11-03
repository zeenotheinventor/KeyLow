import { KeyLowProvider, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { buildFood } from "@keylow/core/testing";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { FavouriteFoods } from "./FavouriteFoods";

import type { FavouriteFoodsProps } from "./types";
import type { Database, FavouriteFood, FavouriteRecipe } from "@keylow/api-client";
import type { Meta, StoryObj } from "@storybook/react-native";

// Switch the theme in the Storybook panel to see the strip in dark and in light.

const pending = () => new Promise<Response>(() => undefined);
const loadingClient = createClient<Database>("http://localhost", "story-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: pending },
});

const foodNames = ["Porridge", "Greek yoghurt", "Banana", "Chicken breast, meal prep"];
const recipeNames = ["Chicken and rice", "Overnight oats"];

const foods: FavouriteFood[] = foodNames.map((name, index) => {
  const foodId = `00000000-0000-4000-8000-00000000f00${index}`;

  return {
    foodId,
    createdAt: `2026-10-${String(20 - index * 2).padStart(2, "0")}T08:00:00+00:00`,
    food: buildFood({ id: foodId, name }),
  };
});

const recipes: FavouriteRecipe[] = recipeNames.map((name, index) => ({
  recipeId: `00000000-0000-4000-8000-00000000b00${index}`,
  createdAt: `2026-10-${String(19 - index * 4).padStart(2, "0")}T08:00:00+00:00`,
  recipe: {
    id: `00000000-0000-4000-8000-00000000b00${index}`,
    name,
    servings: 4,
    yield_grams: 1100,
    is_archived: false,
    computed: {
      total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
      perServing: { kcal: 374.2, protein_g: 31.6, carbs_g: 42.5, fat_g: 8.1, fibre_g: null },
      per100g: { kcal: 136.1, protein_g: 11.5, carbs_g: 15.5, fat_g: 2.95, fibre_g: null },
      totalGrams: 720,
      effectiveGrams: 1100,
      engineVersion: 1,
    },
  },
}));

function filledQueryClient(isFilled: boolean): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  queryClient.setQueryData(keys.profiles.termsAcceptance, {
    terms_accepted_at: "2026-10-15T09:30:00+00:00",
    terms_version: TERMS_VERSION,
  });
  if (isFilled) {
    queryClient.setQueryData(keys.foods.favourites, foods);
    queryClient.setQueryData(keys.recipes.favourites, recipes);
  }

  return queryClient;
}

// The sheet's list gives the strip 16 points at each side, which the story gives it too.
function Scene({ isFilled, ...props }: FavouriteFoodsProps & { isFilled: boolean }) {
  const [queryClient] = useState(() => filledQueryClient(isFilled));

  return (
    <KeyLowProvider client={loadingClient} queryClient={queryClient}>
      <View className="flex-1 justify-center px-4">
        <FavouriteFoods {...props} />
      </View>
    </KeyLowProvider>
  );
}

const meta = {
  title: "FoodSearch/FavouriteFoods",
  component: Scene,
  args: { isFilled: true, onOpenFood: () => undefined, onOpenRecipe: () => undefined },
} satisfies Meta<typeof Scene>;

export default meta;

type Story = StoryObj<typeof meta>;

// Two recipes and four foods, newest first, the last tile cut at the right edge.
export const Strip: Story = {};

// While the favourites load, round bones in the place of the tiles.
export const Loading: Story = { args: { isFilled: false } };
