import type { RecipeCompareCard } from "@keylow/core";

export type CompareFiguresProps = {
  /** "Per serving". */
  label: string;
  beforeLabel: string;
  afterLabel: string;
  figures: RecipeCompareCard["figures"];
};
