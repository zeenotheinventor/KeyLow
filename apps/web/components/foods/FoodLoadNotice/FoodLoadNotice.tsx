import type { FoodLoadNoticeProps } from "./types";

export function FoodLoadNotice({ state }: FoodLoadNoticeProps) {
  switch (state.kind) {
    case "loading":
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <p role="status" className="text-sm text-muted-foreground">
            Loading food
          </p>
        </div>
      );
    case "failed":
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        </div>
      );
    case "not_found":
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold">Food not found</h1>
          <p className="text-sm text-muted-foreground">
            This food does not exist, or it is not one you can see.
          </p>
        </div>
      );
  }
}
