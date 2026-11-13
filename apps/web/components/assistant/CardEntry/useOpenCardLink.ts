"use client";

import { useRouter } from "next/navigation";

import { useAssistant } from "../AssistantProvider";
import { useIsDockedPanel } from "../useIsDockedPanel";

import type { AssistantCardLink } from "@keylow/core";

import { assistantCardHref } from "@/lib/assistantCardHref";

/**
 * What a card's link does. Docked beside the page the panel stays open and the page beside it navigates.
 * As a sheet over the page it closes first, so the page it opens is the one on screen, as the phone does.
 */
export function useOpenCardLink(): (target: AssistantCardLink["target"]) => void {
  const router = useRouter();
  const { close } = useAssistant();
  const isDocked = useIsDockedPanel();

  return (target) => {
    const href = assistantCardHref(target);
    if (href === null) {
      return;
    }
    if (!isDocked) {
      close();
    }
    router.push(href);
  };
}
