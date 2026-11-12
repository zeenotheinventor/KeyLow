import type { CopyYesterday } from "@/components/diary/useCopyYesterday";
import type { DiaryDay, Targets } from "@keylow/api-client";
import type { RefObject } from "react";

export type DiaryDayContentProps = {
  day: DiaryDay;
  targets: Targets;
  timeZone: string;
  /** The hour on the clock now, 0 to 23. */
  currentHour: number;
  /** The diary shows today. */
  isToday: boolean;
  /** Copy yesterday, which the empty day's card offers. */
  copy: CopyYesterday;
  /** The food log's element, which `copy` gives keyboard focus a control in. */
  logElement: RefObject<HTMLDivElement | null>;
  /** The bars open Targets. */
  onOpenTargets: () => void;
};
