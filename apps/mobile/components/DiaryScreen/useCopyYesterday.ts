import { CopyDayPartialWriteError, useCopyDay, useUndoCopyDay } from "@keylow/api-client";
import { UNDO_LABEL, describeCopiedFromYesterday } from "@keylow/core/copy";
import { previousCalendarDay } from "@keylow/core/dates";
import { useState } from "react";

import { useToast } from "../ui";

type CopyYesterday = {
  /** Copies the day before the day on view onto it, each entry at its clock time, after what is there. */
  copyYesterday: () => void;
  isCopying: boolean;
  /** The last copy onto the day on view failed. A new copy, or another day, clears it. */
  hasCopyFailed: boolean;
};

/**
 * Copy yesterday for the day on view: the whole of the day before, copied at once, with a toast
 * "Copied 8 entries from yesterday" and Undo that removes exactly those copies. A copy that fails says
 * so through `hasCopyFailed` and shows no toast. When it stopped part way and could not take back the
 * copies it had made, they are taken back here, so the failure it reports is the whole truth.
 */
export function useCopyYesterday(viewedDate: string, timeZone: string): CopyYesterday {
  const toast = useToast();
  const copyDay = useCopyDay();
  const undoCopyDay = useUndoCopyDay();
  const [failedDate, setFailedDate] = useState<string | null>(null);

  function copyYesterday() {
    setFailedDate(null);
    copyDay.mutate(
      { from: previousCalendarDay(viewedDate), to: viewedDate, timeZone },
      {
        onSuccess: (copied) => {
          // Yesterday had nothing to copy, which the menu and the empty day's button already say.
          if (copied.count > 0) {
            toast.show({
              message: describeCopiedFromYesterday(copied.count),
              icon: "Copy",
              actionLabel: UNDO_LABEL,
              onAction: () => {
                undoCopyDay.mutate(copied);
              },
            });
          }
        },
        onError: (error) => {
          setFailedDate(viewedDate);
          if (error instanceof CopyDayPartialWriteError) {
            undoCopyDay.mutate({
              localDate: viewedDate,
              count: error.entryIds.length,
              entryIds: error.entryIds,
            });
          }
        },
      },
    );
  }

  return {
    copyYesterday,
    isCopying: copyDay.isPending,
    hasCopyFailed: failedDate === viewedDate,
  };
}
