import { ChefHat } from "lucide-react";

import { ComingSoon } from "../ComingSoon";
import { PageFrame } from "../PageFrame";

export default function RecipesPage() {
  return (
    <PageFrame variant="shell">
      <ComingSoon title="Recipes" icon={ChefHat} body="Your recipes will appear here." />
    </PageFrame>
  );
}
