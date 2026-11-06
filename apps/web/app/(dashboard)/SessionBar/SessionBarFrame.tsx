"use client";

import { useSessionBarView } from "@keylow/api-client";
import { TRAIN_TODAY_CARD } from "@keylow/core/copy";
import { usePathname } from "next/navigation";

import { SessionBarLink } from "./SessionBarLink";

import type { SessionBarFrameProps } from "./types";

import { trainSessionPath } from "@/lib/trainRoutes";
import { cn } from "@/lib/utils";

/**
 * Holds the session bar above the page of every signed-in screen but the session's own, while a session is
 * open. The layout is a server component, so this is the client piece that reads the open session. While the
 * bar renders, the element around the page sets `--session-bar-offset` to the bar's height, which the one
 * sticky-to-top element in the app (the recipe editor's summary column) adds to its own top. The value is the
 * `control-lg` token the bar's `h-control-lg` reads, through `theme()`, because the web does not load the
 * token CSS variables. The page is `children`, an element made by the layout, so the tick of the clock, which
 * lives inside the bar, never draws it again. The bar is in a labelled `aside`, which is the sticky element
 * (a sticky link would only hold inside its own box). The `aside` carries `data-session-bar`, which
 * `globals.css` reads to pad the scroll of the window by the bar's height, so a focused link is never left
 * under it.
 */
export function SessionBarFrame({ children }: SessionBarFrameProps) {
  const pathname = usePathname();
  // The terms gate is the layout's, so every read here is allowed.
  const view = useSessionBarView();
  const isBarShown = view !== null && pathname !== trainSessionPath();

  return (
    <>
      {isBarShown && (
        <aside
          aria-label={TRAIN_TODAY_CARD.inProgressLabel}
          data-session-bar
          className="sticky top-0 z-[5] shrink-0"
        >
          <SessionBarLink {...view} />
        </aside>
      )}
      <div className={cn(isBarShown && "[--session-bar-offset:theme(height.control-lg)]")}>
        {children}
      </div>
    </>
  );
}
