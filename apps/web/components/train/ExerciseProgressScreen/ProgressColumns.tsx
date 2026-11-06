import type * as React from "react";

/**
 * The page's two columns, as `WeightScreen` splits them: the Range control and the chart in the first, the
 * weeks in the second, 400 wide from the large breakpoint, and one column under it. The loaded page and
 * its skeleton share them, so the columns do not jump when the read lands.
 */
export function ProgressColumns({
  main,
  weeks,
}: {
  main: React.ReactNode;
  weeks: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      <div className="flex min-w-0 flex-col gap-4">{weeks}</div>
    </div>
  );
}
