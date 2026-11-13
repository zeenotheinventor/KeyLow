"use client";

import { useAssistantThreadActions } from "../AssistantThread/AssistantThreadContext";

import type { ConfirmEntryProps } from "./types";

import { Button } from "@/components/ui/Button";

/**
 * The two answers under a confirmation (`web-assistant · confirm`): the action in its tone, then the cancel
 * in the secondary look, side by side in equal widths. Both words arrive with the question, and pressing
 * one sends it as your message. They are off while a turn streams.
 */
export function ConfirmEntry({ entry }: ConfirmEntryProps) {
  const { canAnswer, onAnswer } = useAssistantThreadActions();
  return (
    <div className="flex gap-2">
      <Button
        className="min-w-0 flex-1"
        disabled={!canAnswer}
        variant={entry.tone === "danger" ? "destructive" : "primary"}
        onClick={() => {
          onAnswer(entry.confirmLabel);
        }}
      >
        {entry.confirmLabel}
      </Button>
      <Button
        className="min-w-0 flex-1"
        disabled={!canAnswer}
        variant="secondary"
        onClick={() => {
          onAnswer(entry.cancelLabel);
        }}
      >
        {entry.cancelLabel}
      </Button>
    </div>
  );
}
