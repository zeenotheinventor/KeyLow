import type { AggregatedIngredients } from "@keylow/core/shopping";
import type { ReactNode } from "react";

export type AddToListScreenProps = {
  /** The recipe's id, from the address. */
  id: string;
  /**
   * The servings to start at, as the address carries them. Text that is not a servings number for this
   * recipe starts at the recipe's own.
   */
  servingsText: string | undefined;
};

export type DraftGroupsProps = {
  preview: AggregatedIngredients;
  /** The foods of the staples chosen to add anyway. */
  addAnyway: readonly string[];
  onToggleStaple: (foodId: string, checked: boolean) => void;
  /** Whether each line names the recipes its amount came from. Defaults to false. */
  showsSources?: boolean;
};

export type AddToListLayoutProps = {
  /** The line under the title: what is being added. */
  subtitle: string | undefined;
  /** False while there is nothing to add or the content is not ready. */
  canAdd: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onLeave: () => void;
  children: ReactNode;
};
