import type { DiaryView } from "@/lib/diary";

export type DiaryScreenProps = {
  /** The `date` search parameter when it is one real day (`YYYY-MM-DD`), otherwise undefined. */
  date: string | undefined;
  /** The `view` search parameter. */
  view: DiaryView;
};
