import { Redirect } from "expo-router";

import { recipesPath } from "../../lib/recipeRoutes";

// The library was a tab at this address and is now a screen of the More tab. An old link, a notification or
// a saved route still lands on it, inside More, with More current in the bar.
export default function OldRecipesRoute() {
  return <Redirect href={recipesPath()} />;
}
