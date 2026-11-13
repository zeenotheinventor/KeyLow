import { EXERCISE_FORM } from "@keylow/core/copy";
import { CameraOff } from "lucide-react";
import { useState } from "react";

import type { FormImageProps } from "./types";

import { cn } from "@/lib/utils";

/**
 * A picture of the card, cropped to its size with cover. When it does not load, the placeholder tile takes
 * its place at the same size, so the card does not change height. The picture is asked for without a
 * referrer, so the host that serves it learns nothing about where it was drawn.
 */
export function FormImage({ url, label, sizeClassName, children }: FormImageProps) {
  // The address that failed, so a new address gets its own try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === url) {
    return (
      <div
        aria-label={EXERCISE_FORM.imageFailedName}
        className={cn(
          "flex items-center justify-center border border-border bg-surface-raised text-text-muted",
          sizeClassName,
        )}
        role="img"
      >
        <CameraOff aria-hidden="true" className="size-5" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={label}
        className={cn("block object-cover", sizeClassName)}
        referrerPolicy="no-referrer"
        src={url}
        onError={() => {
          setFailedUrl(url);
        }}
      />
      {children}
    </div>
  );
}
