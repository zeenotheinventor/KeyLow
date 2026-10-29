import { RecipeLibrary } from "../../../../components/RecipeLibrary";

// Pushed inside the More tab from the Recipes row of its Nutrition section. The root layout's AuthGate covers
// it, and the stack above gives it no header.
export default function RecipesRoute() {
  return <RecipeLibrary />;
}
