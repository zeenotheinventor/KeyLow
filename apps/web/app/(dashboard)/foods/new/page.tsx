import { Suspense } from "react";

import { NewFoodScreen } from "./NewFoodScreen";

export default function NewFoodPage() {
  return (
    <Suspense>
      <NewFoodScreen />
    </Suspense>
  );
}
