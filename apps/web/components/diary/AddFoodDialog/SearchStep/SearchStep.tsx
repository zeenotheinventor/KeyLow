import { MIN_SEARCH_LENGTH, useFoodSearch } from "@keylow/api-client";
import {
  ADD_FOOD_DIALOG,
  DIARY_ACTIONS,
  SEARCH_EMPTY,
  SEARCH_FAILED_WEB,
  SEARCH_GROUP_HEADINGS,
  SEARCH_IDLE,
  SEARCH_STATUS,
} from "@keylow/core/copy";
import { foodNeedsReview } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";
import {
  FOOD_SEARCH_GROUP_LIMITS,
  describeFoodRow,
  describeMacros,
  groupFoodSearchResults,
  servingOfSearchHit,
} from "@keylow/core/search";
import { SearchX, Zap } from "lucide-react";
import { useState } from "react";

import { RecipeLogGroup } from "./RecipeLogGroup";
import { NO_RECIPES, useRecipesToLog } from "./useRecipesToLog";

import type { LogSearchStepProps, SearchStepProps } from "./types";
import type { RecipeSummary } from "@keylow/api-client";
import type { FoodSearchGroupKey, FoodSearchGroupLimits } from "@keylow/core/search";

import { InlineStatus } from "@/components/foods/InlineStatus";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FoodRow } from "@/components/ui/FoodRow";
import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";
import { SearchField } from "@/components/ui/SearchField";
import { Skeleton } from "@/components/ui/Skeleton";
import { TimeField } from "@/components/ui/TimeField";
import { useIsOnline } from "@/lib/useIsOnline";
import { cn } from "@/lib/utils";

// Only the foods in the database are searched here, so the one-tap plus has a food to log: the live Open
// Food Facts candidates are not, because they would have to be added to the database first.
const LOCAL_ONLY = { offThreshold: 0 };

type Expansion = { query: string; groups: readonly FoodSearchGroupKey[] };

// A group the user has opened shows every row the search returned.
function limitsFor(
  expanded: readonly FoodSearchGroupKey[],
  rowCount: number,
): FoodSearchGroupLimits {
  return {
    yours: expanded.includes("yours") ? rowCount : FOOD_SEARCH_GROUP_LIMITS.yours,
    common: expanded.includes("common") ? rowCount : FOOD_SEARCH_GROUP_LIMITS.common,
    branded: expanded.includes("branded") ? rowCount : FOOD_SEARCH_GROUP_LIMITS.branded,
  };
}

/**
 * The add dialog's first step: the search field with the Time field beside it, and under them the foods
 * found, each with the serving its one-tap plus logs. The rows keep the database's ranking order. A row
 * shows the food's serving and the values for that serving, a food with a missing value shows Needs review
 * and a chevron in place of the plus, and a press on the row goes to the portion step. The user's recipes
 * that match come first, in their own group, each with a plus that logs one serving, and a press on the row
 * goes to the amount step for the recipe. In `ingredient` mode,
 * a recipe's, there is no Time field, no plus, no Quick add row and no recipes (a recipe is not an
 * ingredient of itself): a press on a row is the only way on.
 */
export function SearchStep(props: SearchStepProps) {
  return props.mode === "ingredient" ? (
    <SearchStepView {...props} recipes={NO_RECIPES} isSearchingRecipes={false} />
  ) : (
    <LogSearchStep {...props} />
  );
}

// Only here are the recipes searched, so an ingredient search never asks for them.
function LogSearchStep(props: LogSearchStepProps) {
  const { recipes, isSearching } = useRecipesToLog(props.query);

  return <SearchStepView {...props} recipes={recipes} isSearchingRecipes={isSearching} />;
}

type RecipeResults = {
  recipes: readonly RecipeSummary[];
  isSearchingRecipes: boolean;
};

function SearchStepView(props: SearchStepProps & RecipeResults) {
  const { query, onQueryChange, searchRef, onOpenFood, recipes } = props;
  const isOnline = useIsOnline();
  const trimmedQuery = query.trim();
  const { local, isLoadingLocal, isDebouncing, localError } = useFoodSearch(
    trimmedQuery,
    LOCAL_ONLY,
  );
  const [expansion, setExpansion] = useState<Expansion>({ query: "", groups: [] });

  const isSearchable = trimmedQuery.length >= MIN_SEARCH_LENGTH;
  const isSearching = isDebouncing || isLoadingLocal || props.isSearchingRecipes;
  const expanded = expansion.query === trimmedQuery ? expansion.groups : [];
  const groups = groupFoodSearchResults(local, { limit: limitsFor(expanded, local.length) });

  const renderResults = () => {
    if (!isSearchable) {
      // Before anything is typed the search offers Quick add, as the mobile search does (the web has no
      // idle board, so it follows the mobile `log-search.idle` one). An ingredient search has none.
      return (
        <>
          {props.mode !== "ingredient" && (
            <Card asChild padding="none">
              <ul>
                <ListRow
                  icon={Zap}
                  title={DIARY_ACTIONS.quickAdd}
                  subtitle={DIARY_ACTIONS.quickAddCaption}
                  onClick={props.onQuickAdd}
                />
              </ul>
            </Card>
          )}
          <p className="text-caption text-text-muted">{SEARCH_IDLE.hint}</p>
        </>
      );
    }
    if (localError !== null) {
      return (
        <ErrorState size="section" title={SEARCH_FAILED_WEB.title} body={SEARCH_FAILED_WEB.body} />
      );
    }
    if (isSearching && local.length === 0 && recipes.length === 0) {
      return (
        <>
          <InlineStatus>{SEARCH_STATUS.searchingYourFoods}</InlineStatus>
          <Skeleton variant="rows" label="Loading your foods" />
        </>
      );
    }
    if (local.length === 0 && recipes.length === 0) {
      return (
        <EmptyState
          icon={SearchX}
          size="section"
          title={SEARCH_EMPTY.title}
          body={SEARCH_EMPTY.body}
        />
      );
    }

    return (
      <div
        role="group"
        aria-label="Search results"
        aria-busy={isSearching || undefined}
        className={cn("flex flex-col gap-3", isSearching && "opacity-50")}
      >
        {props.mode !== "ingredient" && recipes.length > 0 && (
          <RecipeLogGroup
            recipes={recipes}
            query={trimmedQuery}
            addDisabled={!isOnline}
            onOpen={props.onOpenRecipe}
            onAdd={props.onAddRecipeServing}
          />
        )}
        {groups.map((group) => {
          const { title, caption } = SEARCH_GROUP_HEADINGS[group.key];

          return (
            <GroupedList
              key={group.key}
              title={title}
              source={caption}
              seeMore={{
                hiddenCount: group.hiddenCount,
                onClick: () => {
                  setExpansion({ query: trimmedQuery, groups: [...expanded, group.key] });
                },
              }}
            >
              {group.visibleRows.map((hit) => {
                const { nameSegments, brand } = describeFoodRow(hit, trimmedQuery);
                const serving = servingOfSearchHit(hit);
                const macros = describeMacros(serving);

                return (
                  <FoodRow
                    key={hit.id}
                    layout="search"
                    nameSegments={nameSegments}
                    brand={brand}
                    caption={serving.caption}
                    energy={serving.kcal === null ? undefined : formatCalories(serving.kcal)}
                    macros={{
                      protein: macros.protein ?? "-",
                      carbs: macros.carbs ?? "-",
                      fat: macros.fat ?? "-",
                      description: macros.accessibleDescription,
                    }}
                    needsReview={foodNeedsReview(hit)}
                    onClick={() => {
                      onOpenFood(hit.id);
                    }}
                    {...(props.mode === "ingredient"
                      ? {}
                      : {
                          addDisabled: !isOnline,
                          onAdd: () => {
                            props.onAddServing(hit);
                          },
                        })}
                  />
                );
              })}
            </GroupedList>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <SearchField
          ref={searchRef}
          label={ADD_FOOD_DIALOG.searchLabel}
          placeholder="Name or brand"
          autoComplete="off"
          className="min-w-0 flex-1"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
        />
        {props.mode !== "ingredient" && (
          <TimeField compact value={props.time} isNow={props.isNow} onChange={props.onTimeChange} />
        )}
      </div>
      {renderResults()}
    </>
  );
}
