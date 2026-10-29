import { Redirect } from "expo-router";

import { archivedRecipesPath } from "../../lib/recipeRoutes";

// The archived recipes moved into the More tab with the library. Without this file the old address would be
// read as a recipe whose id is "archived".
export default function OldArchivedRecipesRoute() {
  return <Redirect href={archivedRecipesPath()} />;
}
