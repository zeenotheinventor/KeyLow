import type { ReactNode } from "react";

export type DiaryFrameProps = {
  /** Defaults to Today. */
  title?: string | undefined;
  moreLabel: string;
  children: ReactNode;
};
