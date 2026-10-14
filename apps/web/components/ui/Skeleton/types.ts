import type * as React from "react";

type SkeletonBase = {
  /** What a screen reader hears while it is shown. Defaults to "Loading". */
  label?: string;
  className?: string;
};

/**
 * Stands in for content that is loading. It shows nothing for the first 200 ms, so a load that is
 * quick never flickers. Pick a built in shape, or pass `SkeletonBone`s as children.
 */
export type SkeletonProps = SkeletonBase &
  (
    | { variant: "text"; lines?: number; count?: never; children?: never }
    | { variant: "rows"; count?: number; lines?: never; children?: never }
    | { variant: "block"; lines?: never; count?: never; children?: never }
    | { variant?: undefined; lines?: never; count?: never; children: React.ReactNode }
  );

export type SkeletonBoneProps = {
  /** Sets the bone's size and shape, such as `h-7 w-[70%]` or `rounded-large`. */
  className?: string;
};
