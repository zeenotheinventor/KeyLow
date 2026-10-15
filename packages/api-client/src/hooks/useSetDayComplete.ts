import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { setDayComplete } from "../repos/dayLogs";
import { weekStartOf } from "../weekStartOf";

import type { DiaryDay, DiaryWeekDay } from "../repos/diary";
import type { DayLog } from "../repos/diarySchemas";

type SetDayCompleteVariables = {
  /** The day, `YYYY-MM-DD`. */
  localDate: string;
  /** True marks the day complete, false clears it. */
  complete: boolean;
};

function withCompletion(
  dayLog: DayLog | null,
  localDate: string,
  complete: boolean,
  completedAt: string,
): DayLog {
  return {
    note: null,
    ...dayLog,
    local_date: localDate,
    is_complete: complete,
    completed_at: complete ? completedAt : null,
  };
}

/**
 * Marks a day complete or not (the toggle on the diary and the check on the week strip). The cached
 * day and week show the change at once, so the strip's check and the incomplete count do not wait
 * for the request, and are put back if it fails. The day, its week and the month's complete days
 * are refreshed after the request.
 */
export function useSetDayComplete() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    // One scope for every day: toggles run one after the other in the order they were made, so a
    // slow answer to an earlier tap cannot land after a later one and undo it. TanStack takes a
    // scope as a static option, so it cannot be one per day. The cache still changes at once.
    scope: { id: "day-complete" },
    mutationFn: ({ localDate, complete }: SetDayCompleteVariables) =>
      setDayComplete(client, localDate, complete),
    onMutate: async ({ localDate, complete }) => {
      const dayKey = keys.diary.day(localDate);
      const weekKey = keys.diary.week(weekStartOf(localDate));
      // A read already on its way would bring the old value back over the optimistic one.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: dayKey }),
        queryClient.cancelQueries({ queryKey: weekKey }),
      ]);

      const previous = {
        day: queryClient.getQueryData<DiaryDay>(dayKey),
        week: queryClient.getQueryData<DiaryWeekDay[]>(weekKey),
      };
      const completedAt = new Date().toISOString();

      queryClient.setQueryData<DiaryDay>(dayKey, (day) =>
        day === undefined
          ? undefined
          : { ...day, dayLog: withCompletion(day.dayLog, localDate, complete, completedAt) },
      );
      queryClient.setQueryData<DiaryWeekDay[]>(weekKey, (week) =>
        week?.map((day) =>
          day.localDate === localDate
            ? { ...day, dayLog: withCompletion(day.dayLog, localDate, complete, completedAt) }
            : day,
        ),
      );

      return previous;
    },
    onError: (_error, { localDate }, previous) => {
      queryClient.setQueryData(keys.diary.day(localDate), previous?.day);
      queryClient.setQueryData(keys.diary.week(weekStartOf(localDate)), previous?.week);
    },
    onSettled: (_result, _error, { localDate }) => {
      for (const queryKey of [
        keys.diary.day(localDate),
        keys.diary.week(weekStartOf(localDate)),
        keys.diary.completeDays(localDate.slice(0, 7)),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
