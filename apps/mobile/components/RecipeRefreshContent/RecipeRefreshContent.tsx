import {
  FOOD_FORM,
  FOOD_MACRO_LABELS,
  RECIPE_EDITOR,
  REFRESH,
  amountCaptionOf,
  beforeAfterFigures,
  describeCountSuffix,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dockBottomPadding } from "../../lib/dockBottomPadding";
import { BeforeAfterRow } from "../BeforeAfterRow";
import { ChangedIngredientCard } from "../ChangedIngredientCard";
import { Button, Card, EmptyState, GroupedList, ListRow, Text } from "../ui";

import type { RecipeRefreshContentProps } from "./types";
import type { ReactNode } from "react";

function Section({
  heading,
  count,
  children,
}: {
  heading: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="px-1">
        <Text role="heading" variant="body-strong">
          {heading}
          <Text tone="muted" variant="caption">
            {describeCountSuffix(count)}
          </Text>
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * What the refresh screen shows once the foods have been checked. With changes: the intro, the Per serving
 * card before and after, the changed ingredients, any that are kept as they are because their food has been
 * deleted, and the ones that did not change, with Apply and Cancel pinned under them. With none: "Nothing to
 * refresh" with Done, and above it the kept ingredients, since a deleted food is still news. It holds no
 * diff of its own: what changed, the figures and the sentences are core's, read from the diff as it came.
 */
export function RecipeRefreshContent({
  diff,
  introRef,
  isApplying,
  isOnline,
  onApply,
  onCancel,
}: RecipeRefreshContentProps) {
  const insets = useSafeAreaInsets();
  // The change at a place and the ingredient at that place are the same ingredient, in the recipe's order.
  const rows = diff.changes.flatMap((change, position) => {
    const ingredient = diff.ingredients[position];
    return ingredient === undefined ? [] : [{ change, amountCaption: amountCaptionOf(ingredient) }];
  });
  const changed = rows.filter(({ change }) => change.changed);
  const kept = rows.filter(({ change }) => change.foodGone);
  const unchanged = rows.filter(({ change }) => !change.changed && !change.foodGone);

  const keptSection =
    kept.length === 0 ? null : (
      <Section count={kept.length} heading={REFRESH.kept}>
        {kept.map(({ change, amountCaption }) => (
          <Card key={change.position}>
            <View className="gap-1">
              <Text variant="body-strong">{change.name.after}</Text>
              <Text tone="muted" variant="caption">
                {amountCaption}
              </Text>
              <Text tone="secondary" variant="caption">
                {REFRESH.foodGone}
              </Text>
            </View>
          </Card>
        ))}
      </Section>
    );

  if (!diff.hasChanges) {
    return (
      <View className="flex-1">
        {keptSection === null ? null : <View className="px-4 pt-1">{keptSection}</View>}
        <EmptyState
          action={{ label: REFRESH.done, onPress: onCancel }}
          body={REFRESH.nothingBody}
          icon="CircleCheck"
          title={REFRESH.nothingTitle}
        />
      </View>
    );
  }

  const { perServing } = diff;

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-4 pb-6 pt-1">
        <View ref={introRef} accessible aria-label={REFRESH.intro} className="px-1">
          <Text tone="secondary">{REFRESH.intro}</Text>
        </View>
        <Card aria-label={REFRESH.perServingRegionName} role="region">
          <View>
            <View className="pb-1">
              <Text role="heading" variant="body-strong">
                {RECIPE_EDITOR.perServingNoValue}
              </Text>
            </View>
            <BeforeAfterRow
              figures={beforeAfterFigures(REFRESH.calories, perServing.kcal, "energy")}
              label={REFRESH.calories}
              marker="none"
            />
            <BeforeAfterRow
              hasDivider
              figures={beforeAfterFigures(FOOD_MACRO_LABELS.protein, perServing.protein_g, "grams")}
              label={FOOD_MACRO_LABELS.protein}
              marker="protein"
            />
            <BeforeAfterRow
              hasDivider
              figures={beforeAfterFigures(FOOD_MACRO_LABELS.carbs, perServing.carbs_g, "grams")}
              label={FOOD_MACRO_LABELS.carbs}
              marker="carbs"
            />
            <BeforeAfterRow
              hasDivider
              figures={beforeAfterFigures(FOOD_MACRO_LABELS.fat, perServing.fat_g, "grams")}
              label={FOOD_MACRO_LABELS.fat}
              marker="fat"
            />
          </View>
        </Card>
        <Section count={changed.length} heading={REFRESH.changed}>
          {changed.map(({ change, amountCaption }) => (
            <ChangedIngredientCard
              key={change.position}
              amountCaption={amountCaption}
              change={change}
            />
          ))}
        </Section>
        {keptSection}
        {unchanged.length === 0 ? null : (
          <Section count={unchanged.length} heading={REFRESH.unchanged}>
            <GroupedList hidesTitle title={REFRESH.unchanged}>
              {unchanged.map(({ change, amountCaption }) => (
                <ListRow key={change.position} subtitle={amountCaption} title={change.name.after} />
              ))}
            </GroupedList>
          </Section>
        )}
      </ScrollView>
      {/* The dock is the sheet's surface under a hairline, with the board's 42 below its buttons. It is a
          sibling of the list, so the list ends above it and nothing scrolls under Apply. */}
      <View
        className="gap-2 border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
        style={vars({ "--dock-bottom": dockBottomPadding(insets.bottom) })}
      >
        <Button
          fullWidth
          accessibilityLabel={`${REFRESH.apply}, ${REFRESH.applyHint}`}
          disabled={!isOnline}
          haptic="confirm"
          loading={isApplying}
          size="lg"
          onPress={onApply}
        >
          {REFRESH.apply}
        </Button>
        <Button fullWidth disabled={isApplying} size="lg" variant="secondary" onPress={onCancel}>
          {FOOD_FORM.cancel}
        </Button>
      </View>
    </>
  );
}
