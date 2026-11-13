import { EXERCISE_FORM, describeFormVideoLink } from "@keylow/core/copy";
import { ChevronRight, Play } from "lucide-react";

import { FormImage } from "../FormImage";

import type { FormVideoCardProps } from "./types";

function PlayGlyph() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 m-auto flex size-8 items-center justify-center rounded-pill bg-accent text-accent-foreground"
    >
      <Play className="size-4" />
    </span>
  );
}

/**
 * The video as one link card: the 16:9 poster with a play glyph, the title, the channel, and under a hairline
 * the line that says it opens in YouTube. It opens the watch address in a new tab. Nothing plays here, and no
 * YouTube frame is ever loaded.
 */
export function FormVideoCard({ title, channel, thumbnailUrl, watchUrl }: FormVideoCardProps) {
  return (
    <a
      aria-label={describeFormVideoLink(title, channel)}
      className="flex flex-col overflow-hidden rounded-large border border-border bg-surface text-text-primary shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset"
      href={watchUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="flex items-start gap-3 p-3">
        <span className="relative block shrink-0 overflow-hidden rounded-medium">
          <FormImage label={title} sizeClassName="h-[72px] w-[128px]" url={thumbnailUrl}>
            <PlayGlyph />
          </FormImage>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-body-strong">{title}</span>
          <span className="truncate text-caption text-text-secondary">{channel}</span>
        </span>
      </span>
      <span className="flex min-h-11 items-center gap-2 border-t border-border px-3 text-accent-ink">
        <span className="flex-1 text-body-strong">{EXERCISE_FORM.opensInYouTube}</span>
        <ChevronRight aria-hidden="true" className="size-4" />
      </span>
    </a>
  );
}
