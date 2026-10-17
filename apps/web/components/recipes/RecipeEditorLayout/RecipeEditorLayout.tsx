import type { RecipeEditorLayoutProps } from "./types";

/**
 * The page of the recipe editor. From the large width it is two columns, about 720 wide for the cards and
 * 340 for a summary column that stays in view while the cards scroll: the Per serving card, Save and Cancel.
 * Below it, one column with the Per serving card first, and Save in a bar that sticks to the bottom of the screen and ends above the page footer. The
 * summary is drawn once, so a screen reader meets one Per serving card, and the order changes with CSS.
 */
export function RecipeEditorLayout({
  notices,
  summary,
  actions,
  children,
}: RecipeEditorLayoutProps) {
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,720px)_minmax(0,340px)] lg:items-start lg:gap-x-6">
      <div className="flex flex-col gap-5 max-lg:contents lg:col-start-1 lg:row-start-1 lg:min-w-0">
        {notices !== undefined && <div className="flex flex-col gap-5">{notices}</div>}
        <div className="flex min-w-0 flex-col gap-5 max-lg:order-2">{children}</div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 max-lg:contents lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
        <div className="max-lg:order-1">{summary}</div>
        {actions !== undefined && (
          <div className="flex flex-col gap-3 max-lg:sticky max-lg:bottom-0 max-lg:order-3 max-lg:-mx-4 max-lg:border-t max-lg:border-border max-lg:bg-surface-sheet max-lg:px-4 max-lg:pb-4 max-lg:pt-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
