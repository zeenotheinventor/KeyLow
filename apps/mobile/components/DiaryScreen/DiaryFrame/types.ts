import type { ReactNode } from "react";

export type DiaryFrameProps = {
  /** Defaults to Today. */
  title?: string | undefined;
  moreLabel: string;
  onChooseDate?: (() => void) | undefined;
  onMore?: (() => void) | undefined;
  children: ReactNode;
};
