import { describeAssistantEmpty } from "@keylow/core";
import { ASSISTANT_NOT_MEDICAL_ADVICE, ASSISTANT_SHEET } from "@keylow/core/copy";
import { ArrowUp } from "lucide-react";

import type { AssistantEmptyProps } from "./types";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";

/**
 * The empty panel in the thread (`web-assistant · empty`, `empty-train`): a heading, a line on how to say it,
 * the starters that each send their words, and the not-medical-advice line. Core says which words the
 * panel has, for the way it was opened.
 */
export function AssistantEmpty({ onStarterPress, isDisabled, from }: AssistantEmptyProps) {
  const words = describeAssistantEmpty(undefined, from);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2">{words.heading}</h2>
        <p className="text-body text-text-secondary">{words.lede}</p>
      </div>
      <GroupedList hidesTitle title={ASSISTANT_SHEET.startersLabel}>
        {words.starters.map((starter) => (
          <ListRow
            key={starter}
            className="min-h-[52px]"
            disabled={isDisabled}
            title={starter}
            titleWeight="regular"
            trailingIcon={ArrowUp}
            onClick={() => {
              onStarterPress(starter);
            }}
          />
        ))}
      </GroupedList>
      {words.isNotMedicalLineShown ? (
        <p className="text-caption text-text-muted">{ASSISTANT_NOT_MEDICAL_ADVICE}</p>
      ) : null}
    </div>
  );
}
