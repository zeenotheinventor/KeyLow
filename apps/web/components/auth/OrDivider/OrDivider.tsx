import { SIGN_UP_SCREEN } from "@keylow/core/copy";

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-caption text-text-muted">
      <span className="h-px flex-1 bg-border" />
      {SIGN_UP_SCREEN.divider}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
