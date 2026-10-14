import { Suspense } from "react";

import { NewFoodScreen } from "./NewFoodScreen";

import { PageFrame } from "@/app/(dashboard)/PageFrame";

export default function NewFoodPage() {
  return (
    <PageFrame variant="foodRecord">
      <Suspense>
        <NewFoodScreen />
      </Suspense>
    </PageFrame>
  );
}
