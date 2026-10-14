import { PLACEHOLDER_BODIES, TAB_TITLES } from "@keylow/core/copy";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export default function RecipesRoute() {
  return (
    <PlaceholderScreen
      body={PLACEHOLDER_BODIES.recipes}
      icon="ChefHat"
      title={TAB_TITLES.recipes}
    />
  );
}
