import { skeletonDelay } from "@keylow/tokens";
import { useEffect, useState } from "react";

import type { SkeletonBoneProps, SkeletonProps } from "./types";

import { cn } from "@/lib/utils";

const rowTitleWidths = ["w-[70%]", "w-[52%]", "w-[64%]"] as const;

/** One grey shape. The shine sweeps across it, and holds still under prefers-reduced-motion. */
export function SkeletonBone({ className }: SkeletonBoneProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "block rounded-small bg-skeleton-base bg-[length:200%_100%] bg-[linear-gradient(100deg,transparent_30%,theme(colors.skeleton-shine)_50%,transparent_70%)] animate-skeleton motion-reduce:animate-none",
        className,
      )}
    />
  );
}

function RowBones({ count }: { count: number }) {
  return (
    <div className="overflow-hidden rounded-large border border-border bg-surface">
      {Array.from({ length: count }, (_, index) => (
        <div
          // The rows are identical placeholders, so their position is their identity.
          key={index}
          className="flex min-h-[60px] items-center gap-3 border-t border-border px-3 py-2 first:border-t-0"
        >
          <SkeletonBone className="size-9" />
          <div className="flex flex-1 flex-col gap-1.5">
            <SkeletonBone className={cn("h-3", rowTitleWidths[index % rowTitleWidths.length])} />
            <SkeletonBone className="h-2.5 w-[30%]" />
          </div>
          <SkeletonBone className="h-4 w-11" />
        </div>
      ))}
    </div>
  );
}

function TextBones({ lines }: { lines: number }) {
  return Array.from({ length: lines }, (_, index) => (
    <SkeletonBone
      key={index}
      className={cn("h-3", index === lines - 1 && lines > 1 ? "w-[60%]" : "w-full")}
    />
  ));
}

export function Skeleton({
  variant,
  lines = 2,
  count = 3,
  label = "Loading",
  className,
  children,
}: SkeletonProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(true);
    }, skeletonDelay);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      role="status"
      aria-label={label}
      className={cn(variant === "text" && "flex flex-col gap-2", className)}
    >
      {shown && (
        <>
          {variant === "rows" && <RowBones count={count} />}
          {variant === "text" && <TextBones lines={lines} />}
          {variant === "block" && <SkeletonBone className="h-24 rounded-large" />}
          {variant === undefined && children}
        </>
      )}
    </div>
  );
}
