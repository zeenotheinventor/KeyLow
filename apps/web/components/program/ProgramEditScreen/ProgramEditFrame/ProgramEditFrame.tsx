import { PROGRAM_EDIT } from "@keylow/core/copy";

import type { ProgramEditFrameProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { cn } from "@/lib/utils";

const PROGRAM_HREF = "/more/program";

/**
 * The top of every Edit programme board: the accent back link to Programme over the title, in the page's 1180.
 * The link leaves without saving and without asking, and is dimmed and inert while a save runs. The footer, when
 * there is one, is the page's last child, so that it sticks to the bottom of the window across the whole page.
 */
export function ProgramEditFrame({ isBackInert = false, footer, children }: ProgramEditFrameProps) {
  return (
    <>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 lg:gap-6">
        <div className="flex flex-col gap-1">
          {/* The board draws the link 44 high with 8 px off its top and bottom in the flow, so its target is 44 and the title sits as drawn. */}
          <div
            // `inert` takes the link out of the tab order and out of the press, and the opacity is the board's dimmed look.
            inert={isBackInert}
            className={cn("-my-2 flex", isBackInert && "opacity-50")}
          >
            <BackToFoodsLink
              tone="accent"
              label={PROGRAM_EDIT.backName}
              href={PROGRAM_HREF}
              onClick={(event) => {
                if (isBackInert) {
                  event.preventDefault();
                }
              }}
            />
          </div>
          <h1 className="text-h1">{PROGRAM_EDIT.title}</h1>
        </div>
        {children}
      </div>
      {footer}
    </>
  );
}
