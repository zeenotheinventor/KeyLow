import { useCopyDay, useDiaryDay, useUndoCopyDay } from "@keylow/api-client";
import { GENERIC_ERROR, UNDO_LABEL, describeCopiedFromYesterday } from "@keylow/core/copy";
import { previousCalendarDay } from "@keylow/core/dates";
import { Copy } from "lucide-react";
import { useRef, useState } from "react";

import type { RefObject } from "react";

import { takeBackPartialCopy } from "@/components/diary/takeBackPartialCopy";
import { useToast } from "@/components/ui/Toast";
import { firstControlIn, useKeyboardUndo } from "@/lib/keyboardUndo";

export type CopyYesterday = {
  /** Yesterday is read and has nothing to copy. */
  isYesterdayEmpty: boolean;
  isCopying: boolean;
  /** The last copy onto this day failed. */
  hasCopyFailed: boolean;
  copyYesterday: () => void;
};

type CopyYesterdayOptions = {
  /** The day on view, `YYYY-MM-DD`: yesterday is copied onto it. */
  localDate: string;
  timeZone: string;
  /** The food log's element, so a keyboard user's focus can be given to a control in it. */
  logElement: RefObject<HTMLDivElement | null>;
  /** Yesterday is read only when this is true, which is once the day has loaded in the day view. */
  enabled: boolean;
};

/**
 * Copy yesterday onto the day on view, after whatever is there, for the empty day's card and the
 * header's button alike. It reads yesterday to know whether there is anything to copy, offers Undo once
 * something was copied, takes back what a failed copy had written, and says where a keyboard user's
 * focus goes when the Undo toast closes.
 */
export function useCopyYesterday({
  localDate,
  timeZone,
  logElement,
  enabled,
}: CopyYesterdayOptions): CopyYesterday {
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const isCopyUndone = useRef(false);
  const copyDay = useCopyDay();
  const undoCopyDay = useUndoCopyDay();
  // The day whose copy failed, so the failure is not carried over to another day.
  const [failedDate, setFailedDate] = useState<string | null>(null);
  if (failedDate !== null && failedDate !== localDate) {
    setFailedDate(null);
  }

  const yesterday = previousCalendarDay(localDate);
  const yesterdayQuery = useDiaryDay(yesterday, { enabled });

  function showFailure() {
    toast.show({ message: GENERIC_ERROR, tone: "danger" });
  }

  // Where a keyboard user's focus goes when the Undo toast closes. A button outside the log, such as the
  // header's, is still there, so it gets focus back. The empty day's card button goes when the copy fills
  // the day, so then it is the first control of the first copied food, which is what the person is about to
  // read, else the day's complete switch, which is on the screen before the copy, after it and after Undo.
  // After Undo the copied foods are going, so it is the switch.
  function focusAfterCopy(pressed: Element | null): HTMLElement | null {
    const log = logElement.current;
    // Nothing focused is the body, as when a screen reader's virtual cursor clicks: not a place to go back to.
    if (
      pressed instanceof HTMLElement &&
      pressed !== document.body &&
      pressed.isConnected &&
      !log?.contains(pressed)
    ) {
      return pressed;
    }
    const completeSwitch = log?.querySelector<HTMLElement>('[role="switch"]') ?? null;
    if (isCopyUndone.current) {
      return completeSwitch;
    }
    // The foods of an hour are the one card an hour's group holds. The empty day's card is not in a group.
    const firstFoods = log?.querySelector('[role="group"] section') ?? null;

    return firstControlIn(firstFoods) ?? completeSwitch;
  }

  function copyYesterday() {
    isCopyUndone.current = false;
    const pressed = document.activeElement;
    // Asked as the press arrives, while focus is still on the button, and settled when the copy is done.
    const keyboardRoute = keyboardUndo.afterPressingButton({
      returnTo: () => focusAfterCopy(pressed),
    });
    setFailedDate(null);
    copyDay.mutate(
      { from: yesterday, to: localDate, timeZone },
      {
        onSuccess: (copied) => {
          // Yesterday had nothing to copy, which the empty day's card already says.
          if (copied.count > 0) {
            toast.show({
              message: describeCopiedFromYesterday(copied.count),
              icon: Copy,
              actionLabel: UNDO_LABEL,
              onAction: () => {
                isCopyUndone.current = true;
                undoCopyDay.mutate(copied, { onError: showFailure });
              },
              ...keyboardRoute(),
            });
          }
        },
        onError: (error) => {
          setFailedDate(localDate);
          takeBackPartialCopy(error, localDate, undoCopyDay.mutate);
        },
      },
    );
  }

  return {
    isYesterdayEmpty: yesterdayQuery.isSuccess && yesterdayQuery.data.entries.length === 0,
    isCopying: copyDay.isPending,
    hasCopyFailed: failedDate === localDate,
    copyYesterday,
  };
}
