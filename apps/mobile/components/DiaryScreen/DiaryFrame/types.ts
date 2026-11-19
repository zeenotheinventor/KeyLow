import type { StreakLine } from "@keylow/core/diary";
import type { ReactNode } from "react";

export type DiaryFrameProps = {
  /** Defaults to Today. */
  title?: string | undefined;
  moreLabel: string;
  /** The header's streak line, or null for none. */
  streakLine?: StreakLine | null | undefined;
  onAssistant?: (() => void) | undefined;
  onChooseDate?: (() => void) | undefined;
  onMore?: (() => void) | undefined;
  children: ReactNode;
};
