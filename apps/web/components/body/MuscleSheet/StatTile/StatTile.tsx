import type { StatTileProps } from "./types";

/** One of the two tiles under the sheet's header: a label, a value, and a line that may start with a swatch. */
export function StatTile({ label, value, caption, swatchClassName }: StatTileProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-medium bg-surface-raised p-3">
      <span className="text-caption text-text-muted">{label}</span>
      <span className="text-numeral-small">{value}</span>
      {caption === null ? null : (
        <span className="flex items-center gap-[6px] text-caption text-text-secondary">
          {swatchClassName === undefined ? null : (
            <span
              aria-hidden
              className={`block h-[10px] w-[10px] rounded-[3px] ${swatchClassName}`}
            />
          )}
          {caption}
        </span>
      )}
    </div>
  );
}
