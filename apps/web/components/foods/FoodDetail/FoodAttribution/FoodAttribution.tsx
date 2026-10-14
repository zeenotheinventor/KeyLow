import type { FoodAttributionProps } from "./types";

/** The credit an Open Food Facts or CoFID food must carry, under the rest of the page. */
export function FoodAttribution({ attribution }: FoodAttributionProps) {
  return (
    <footer className="flex flex-col gap-1 border-t border-border px-1 pt-3">
      <p className="text-caption text-text-secondary">{attribution.text}</p>
      <a
        href={attribution.url}
        target="_blank"
        rel="noreferrer"
        className="break-all rounded-small text-caption text-text-secondary underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {attribution.url}
      </a>
    </footer>
  );
}
