import type { RecipeEditorFrameProps } from "./types";

/** The column every state of the recipe editor sits in: the way back, the title, then the content. */
export function RecipeEditorFrame({
  backLink,
  title,
  titleAction,
  children,
}: RecipeEditorFrameProps) {
  const heading = title !== undefined && <h1 className="min-w-0 break-words text-h1">{title}</h1>;

  return (
    <div className="mx-auto flex w-full max-w-[1132px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        {backLink}
        {titleAction === undefined ? (
          heading
        ) : (
          <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
            {heading}
            {titleAction}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
