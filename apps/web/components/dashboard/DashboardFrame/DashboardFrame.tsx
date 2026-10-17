import type { DashboardFrameProps } from "./types";

/**
 * The dashboard's page, as the board draws it: the date over the title, the notices that span the page,
 * then a grid inside a 1180 wide container. The grid has two columns from 1280, the width the board
 * draws, and one below it. Today's nutrition takes the first column and the This week card the second,
 * top aligned with it. Below 1280 the second stacks under the first.
 */
export function DashboardFrame({ eyebrow, banners, aside, children }: DashboardFrameProps) {
  return (
    // The board's container. The shell's main already pads outside it, and 1132 would push the bar
    // tracks under 100 px in the half column.
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <p className="min-h-4 text-caption text-text-muted">{eyebrow}</p>
        <h1 className="text-h1">Dashboard</h1>
      </div>
      {banners}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
        {aside !== undefined && <div className="flex min-w-0 flex-col gap-3">{aside}</div>}
      </div>
    </div>
  );
}
