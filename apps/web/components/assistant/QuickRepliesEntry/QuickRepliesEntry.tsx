"use client";

import { ASSISTANT_SHEET } from "@keylow/core/copy";

import { useAssistantThreadActions } from "../AssistantThread/AssistantThreadContext";

import type { QuickRepliesEntryProps } from "./types";

import { ChipGroup } from "@/components/ui/ChipGroup";

/**
 * The quick replies under a clarifying question (`web-assistant · clarify`): one chip for each natural
 * amount, wrapping, each sent as your message when pressed. They are off while a turn streams.
 */
export function QuickRepliesEntry({ entry }: QuickRepliesEntryProps) {
  const { canAnswer, onAnswer } = useAssistantThreadActions();
  return (
    <ChipGroup
      disabled={!canAnswer}
      label={ASSISTANT_SHEET.quickRepliesLabel}
      options={entry.options.map((reply) => ({ value: reply, label: reply }))}
      selection="action"
      onChipPress={onAnswer}
    />
  );
}
