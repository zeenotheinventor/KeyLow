import type { ReactNode } from "react";

export type DiaryFrameProps = {
  /** Defaults to Today. */
  title?: string | undefined;
  moreLabel: string;
  onAssistant?: (() => void) | undefined;
  onChooseDate?: (() => void) | undefined;
  onMore?: (() => void) | undefined;
  children: ReactNode;
};
