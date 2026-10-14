import type { ReactNode } from "react";

/**
 * The page families whose boards draw different top and bottom padding:
 * - shell: Dashboard, Diary, Recipes and More (docs/design/web)
 * - foodSearch: the foods search and Your foods (docs/design/web-foods)
 * - foodRecord: a food's detail, new and edit screens (docs/design/web-food)
 */
export type PageFrameVariant = "shell" | "foodSearch" | "foodRecord";

export type PageFrameProps = {
  variant: PageFrameVariant;
  children: ReactNode;
};
