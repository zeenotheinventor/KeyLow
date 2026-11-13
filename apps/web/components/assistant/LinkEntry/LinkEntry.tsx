"use client";

import { useOpenCardLink } from "../CardEntry";

import type { LinkEntryProps } from "./types";

import { AssistantLinkRow } from "@/components/ui/AssistantActionCard";

/** The thread's `link` entry: the card's link row on its own, under an answer that made no card. */
export function LinkEntry({ entry }: LinkEntryProps) {
  const openLink = useOpenCardLink();

  return (
    <AssistantLinkRow
      isStandalone
      label={entry.link.label}
      onPress={() => {
        openLink(entry.link.target);
      }}
    />
  );
}
