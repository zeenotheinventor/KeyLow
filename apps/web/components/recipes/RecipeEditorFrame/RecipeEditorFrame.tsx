import type { RecipeEditorFrameProps } from "./types";

/** The column every state of the recipe editor sits in: the way back, the title, then the content. */
export function RecipeEditorFrame({ backLink, title, children }: RecipeEditorFrameProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1132px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        {backLink}
        {title !== undefined && <h1 className="min-w-0 break-words text-h1">{title}</h1>}
      </div>
      {children}
    </div>
  );
}
