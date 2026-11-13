import { memo } from "react";
import { View } from "react-native";

import { Button } from "../../Button";
import { Icon } from "../../Icon";
import { Text } from "../../Text";
import { AssistantActionCard } from "../AssistantActionCard";
import { FitLine } from "./FitLine";
import { TargetFigures } from "./TargetFigures";

import type { AssistantRecipeDraftCardProps } from "./types";

/**
 * A recipe the assistant suggested, as a card in the thread (`assistant-card · recipe-draft`, `-short`,
 * `-unmatched`, `-saved` and `-failed`): the ChefHat tile, the name and whether it is saved, the Per serving
 * figures with what was asked under them, the fit line, a row for each ingredient, Instructions that open in
 * place, and Save to recipes with Adjust. It is the action card with its own lead and footer, so the header
 * and the rows are the card's. It makes no write, so it has no Undo, and once the draft is saved the buttons
 * give way to the link that opens the recipe. Every word and figure is core's. It is memoised, because the
 * thread draws again for every streamed token: its card is a stable reference the sheet keeps.
 */
export const AssistantRecipeDraftCard = memo(function AssistantRecipeDraftCard({
  card,
  isSaving,
  saveError,
  saveLabel,
  adjustLabel,
  savedLink,
  onSave,
  onAdjust,
}: AssistantRecipeDraftCardProps) {
  const isSaved = savedLink !== undefined;

  return (
    <AssistantActionCard
      days={
        card.instructions === null
          ? []
          : [
              {
                name: card.instructions.title,
                summary: card.instructions.summary,
                exercises: card.instructions.steps.map((step) => ({ name: step })),
              },
            ]
      }
      footer={
        isSaved ? null : (
          <>
            {saveError === undefined ? null : (
              // Its own block, announced when it appears, with the buttons under it at 12 points and no hairline.
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
              className={`flex-row gap-2 p-3 ${saveError === undefined ? "border-t border-border" : ""}`}
            >
              <Button className="flex-1" loading={isSaving} onPress={onSave}>
                {saveLabel}
              </Button>
              <Button disabled={isSaving} variant="secondary" onPress={onAdjust}>
                {adjustLabel}
              </Button>
            </View>
          </>
        )
      }
      icon="ChefHat"
      iconTone={isSaved ? "success" : "secondary"}
      lead={
        <>
          <TargetFigures figures={card.figures} label={card.figuresLabel} />
          {card.fit === null ? null : <FitLine text={card.fit.text} tone={card.fit.tone} />}
        </>
      }
      link={savedLink}
      rows={card.rows.map((row) => ({
        name: row.name,
        detail: row.detail,
        value: row.value ?? undefined,
        ...(row.notMatchedBadge === null
          ? {}
          : { match: "unresolved" as const, matchLabel: row.notMatchedBadge }),
      }))}
      subtitle={card.subtitle}
      title={card.title}
    />
  );
});
