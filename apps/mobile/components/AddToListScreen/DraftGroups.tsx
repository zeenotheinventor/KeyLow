import {
  SHOPPING_LIST,
  describeAddAnyway,
  describeLeftOutCount,
  describeShoppingItemCaption,
} from "@keylow/core/copy";
import { View } from "react-native";

import { Checkbox, GroupedList, Text } from "../ui";

import type { DraftGroupsProps } from "./types";
import type { ShoppingDraft } from "@keylow/core/shopping";

const captionOf = (draft: ShoppingDraft, showsSources: boolean): string | undefined =>
  describeShoppingItemCaption({
    grams: draft.grams,
    portion_label: draft.portionLabel,
    portion_count: draft.portionCount,
    sources: showsSources ? draft.sources : [],
  }) ?? undefined;

function DraftText({ draft, showsSources }: { draft: ShoppingDraft; showsSources: boolean }) {
  const caption = captionOf(draft, showsSources);

  return (
    <View className="min-w-0 flex-1">
      <Text variant="body-strong">{draft.name}</Text>
      {caption === undefined ? null : (
        <Text tone="muted" variant="caption">
          {caption}
        </Text>
      )}
    </View>
  );
}

/**
 * What an add would put on the list: the foods to buy under "To buy", and under their own heading the store
 * cupboard staples left out, each with a box that adds it anyway. `showsSources` adds the recipe an amount came
 * from to its line, as the list does, for an add whose amounts come from several.
 */
export function DraftGroups({
  preview,
  addAnyway,
  onToggleStaple,
  showsSources = false,
}: DraftGroupsProps) {
  return (
    <>
      {preview.items.length === 0 && preview.staples.length > 0 ? (
        <Text tone="secondary">{SHOPPING_LIST.onlyStaples}</Text>
      ) : null}

      {preview.items.length > 0 ? (
        <GroupedList title={SHOPPING_LIST.toBuy}>
          {preview.items.map((draft) => (
            <View key={draft.foodId} className="min-h-[52px] flex-row items-center px-4 py-2">
              <DraftText draft={draft} showsSources={showsSources} />
            </View>
          ))}
        </GroupedList>
      ) : null}

      {preview.staples.length > 0 ? (
        <GroupedList
          notice={
            <Text className="px-1" tone="muted" variant="caption">
              {describeLeftOutCount(preview.staples.length)}
            </Text>
          }
          title={SHOPPING_LIST.leftOut}
        >
          {preview.staples.map((draft) => (
            <View key={draft.foodId} className="min-h-[52px] flex-row items-center gap-3 px-4 py-1">
              <DraftText draft={draft} showsSources={showsSources} />
              <View className="pt-2">
                <Checkbox
                  accessibilityLabel={describeAddAnyway(draft.name)}
                  checked={addAnyway.includes(draft.foodId)}
                  label={SHOPPING_LIST.addAnyway}
                  onChange={(checked) => {
                    onToggleStaple(draft.foodId, checked);
                  }}
                />
              </View>
            </View>
          ))}
        </GroupedList>
      ) : null}
    </>
  );
}
