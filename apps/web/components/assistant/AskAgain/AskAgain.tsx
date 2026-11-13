"use client";

import { ASSISTANT_SHEET, ASSISTANT_STOPPED } from "@keylow/core/copy";

import { useAssistantThreadActions } from "../AssistantThread";

import type { AskAgainProps } from "./types";

import { ChipGroup } from "@/components/ui/ChipGroup";

const askAgainOptions = [{ value: "ask-again", label: ASSISTANT_STOPPED.askAgain }];

/**
 * The quick reply at the end of the thread, under an answer that was cut short or that asked for it. Pressing
 * it sends the last message again.
 */
export function AskAgain({ canAskAgain }: AskAgainProps) {
  const { onSendAgain } = useAssistantThreadActions();

  if (!canAskAgain) {
    return null;
  }
  return (
    <ChipGroup
      label={ASSISTANT_SHEET.quickRepliesLabel}
      options={askAgainOptions}
      selection="action"
      onChipPress={onSendAgain}
    />
  );
}
