import type { FoodFormPageProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail/BackToFoodsLink";

/** The column every food form screen sits in: the way back, a heading with an optional sentence, then the content. */
export function FoodFormPage({ backLabel, title, intro, children }: FoodFormPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <BackToFoodsLink label={backLabel} />
      {title !== undefined && (
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1">{title}</h1>
          {intro !== undefined && <p className="text-body text-text-secondary">{intro}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
