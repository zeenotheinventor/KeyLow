"use client";

import { useAssistantCardUndo } from "@keylow/api-client";
import {
  Apple,
  Archive,
  CalendarDays,
  Check,
  ChefHat,
  Copy,
  MessageSquareText,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";

import { useOpenCardLink } from "./useOpenCardLink";

import type { CardEntryProps } from "./types";
import type { AssistantCardIconName } from "@keylow/core";
import type { LucideIcon } from "lucide-react";

import { AssistantActionCard } from "@/components/ui/AssistantActionCard";
import { assistantCardHref } from "@/lib/assistantCardHref";

const icons = {
  Check,
  Copy,
  ChefHat,
  Trash2,
  Apple,
  Target,
  RotateCcw,
  Archive,
  MessageSquareText,
  CalendarDays,
} as const satisfies Record<AssistantCardIconName, LucideIcon>;

/**
 * One write of the assistant in the thread, with its Undo. `useAssistantCardUndo` gives the card its icon,
 * its words as sent and the state of its Undo, and this draws them and opens the link. The days of a
 * routine open one at a time inside the card.
 */
export function CardEntry({ entry }: CardEntryProps) {
  const { look, undoState, undo } = useAssistantCardUndo(entry.card);
  const openLink = useOpenCardLink();
  // The meal plan has no page on the web, so a link to it is not drawn.
  const link =
    look.link !== null && assistantCardHref(look.link.target) !== null ? look.link : null;

  return (
    <AssistantActionCard
      icon={icons[look.icon]}
      days={look.days.length === 0 ? undefined : look.days}
      iconTone={look.iconTone}
      link={
        link === null
          ? undefined
          : {
              label: link.label,
              onPress: () => {
                openLink(link.target);
              },
            }
      }
      note={look.note ?? undefined}
      rows={look.rows}
      subtitle={look.subtitle ?? undefined}
      title={look.title}
      total={look.total ?? undefined}
      undo={{
        state: undoState,
        label: look.undo.label,
        onPress: () => {
          void undo();
        },
      }}
    />
  );
}
