"use client";

import { BODY_MAP } from "@keylow/core/copy";
import { useRouter } from "next/navigation";

import type { MouseEvent } from "react";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";

const DASHBOARD_HREF = "/dashboard";

const isPlainLeftClick = (event: MouseEvent) =>
  event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

// Whether the app has a page of its own before this one. The Navigation API counts only entries of this
// site, so a tab that opened on the body map, whatever came before it in the tab, has none. Browsers
// without it fall back to the length of the history, which also counts a start page.
function hasPageToReturnTo(): boolean {
  if (
    "navigation" in window &&
    typeof window.navigation === "object" &&
    window.navigation !== null &&
    "canGoBack" in window.navigation &&
    typeof window.navigation.canGoBack === "boolean"
  ) {
    return window.navigation.canGoBack;
  }
  return window.history.length > 1;
}

/**
 * The way back from the body map. It returns to the page the person came from, whichever it was (the
 * dashboard card, or later the Train page), and goes to the dashboard when the page was opened directly
 * and the app has no page before it. Where it points is the dashboard, so a click that opens a new tab or
 * window, which has no history to return through, still lands somewhere sensible.
 */
export function BodyMapBackLink() {
  const router = useRouter();

  return (
    <BackToFoodsLink
      tone="accent"
      label={BODY_MAP.back}
      href={DASHBOARD_HREF}
      onClick={(event) => {
        if (isPlainLeftClick(event) && hasPageToReturnTo()) {
          event.preventDefault();
          router.back();
        }
      }}
    />
  );
}
