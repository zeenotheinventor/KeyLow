import { memo } from "react";
import { View } from "react-native";

import { Button } from "../../Button";
import { Icon } from "../../Icon";
import { Text } from "../../Text";
import { AssistantActionCard } from "../AssistantActionCard";
import { FitLine } from "../FitLine";
import { CompareFigures } from "./CompareFigures";

import type { AssistantRecipeCompareCardProps } from "./types";

/**
 * A saved recipe the assistant changed, as a card in the thread (`assistant-card · recipe-compare`): the ChefHat
 * tile, the new recipe's name and what changed, the Per serving table with Before and After, the fit line, a
 * row for each ingredient with its amounts and a badge on the ones that changed, and one action, Save as new
 * recipe, with the line that the original stays as it is. It is the action card with its own lead and footer.
 * It makes no write, so it has no Undo, and once the adjustment is saved the action gives way to the link that
 * opens the new recipe. Every word and figure is core's. It is memoised, because the thread draws again for
 * every streamed token: its card is a stable reference the sheet keeps.
 */
export const AssistantRecipeCompareCard = memo(function AssistantRecipeCompareCard({
  card,
  isSaving,
  saveError,
  saveLabel,
  savedLink,
  onSave,
}: AssistantRecipeCompareCardProps) {
  const isSaved = savedLink !== undefined;

  return (
    <AssistantActionCard
      footer={
        isSaved ? null : (
          <>
            {saveError === undefined ? null : (
              <View
                className="flex-row items-start gap-2 border-t border-border px-3 pt-[10px]"
                role="alert"
              >
                <Icon name="CircleAlert" size="sm" tone="danger" />
                <Text className="flex-1" tone="danger" variant="caption">
                  {saveError}
                </Text>
              </View>
            )}
            <View
              className={`gap-2 p-3 ${saveError === undefined ? "border-t border-border" : ""}`}
            >
              <Button loading={isSaving} onPress={onSave}>
                {saveLabel}
              </Button>
              <Text className="text-center" tone="muted" variant="caption">
                {card.originalStays}
              </Text>
            </View>
          </>
        )
      }
      icon="ChefHat"
      iconTone={isSaved ? "success" : "secondary"}
      lead={
        <>
          <CompareFigures
            afterLabel={card.afterLabel}
            beforeLabel={card.beforeLabel}
            figures={card.figures}
            label={card.figuresLabel}
          />
          {card.fit === null ? null : <FitLine text={card.fit.text} tone={card.fit.tone} />}
        </>
      }
      link={savedLink}
      rows={card.rows.map((row) => ({
        name: row.name,
        detail: row.detail,
        ...(row.badge === null ? {} : { changeLabel: row.badge }),
      }))}
      subtitle={card.subtitle}
      title={card.title}
    />
  );
});
