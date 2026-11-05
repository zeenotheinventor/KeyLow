import { TRAIN_HOME, describeTrainWeekCaption, describeTrainWeekDay } from "@keylow/core/copy";
import { latestFinishedSession, weekCaption, weekDayLookOf } from "@keylow/core/training";

import { PlanWeekDay } from "./PlanWeekDay";

import type { PlanWeekProps } from "./types";

import { Card } from "@/components/ui/Card";
import { trainSessionDetailPath } from "@/lib/trainRoutes";

/**
 * The Train home's "This week" card, as the `web-train · today` board draws it: the caption with the week's
 * range and how many of the routine's days are done, and the seven days from Monday, each with the name of
 * what it holds. A logged day (a routine day done, or a session that is no part of the plan) links to its
 * session, and a day made up later in the week links to the session that made it up. Every word is core's,
 * as on mobile (`PlanWeekStrip`). The diary's `WeekStrip` does not fit
 * here: it carries day totals and picks a day.
 */
export function PlanWeek({ week, weekStart }: PlanWeekProps) {
  const hasRoutine = week.routineDayCount > 0;

  return (
    <Card asChild>
      <section aria-label={TRAIN_HOME.weekSectionName} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-body-strong">{TRAIN_HOME.weekSectionName}</h2>
          <span className="min-w-0 text-caption tabular-nums text-text-secondary">
            {describeTrainWeekCaption(weekStart, weekCaption(week))}
          </span>
        </div>
        <ul className="grid grid-cols-7 gap-1.5">
          {week.days.map((day) => {
            const copy = describeTrainWeekDay(day, hasRoutine);
            const isLogged = day.status === "logged" || day.status === "extra";
            const sessionToView =
              day.madeUpBy ?? (isLogged ? latestFinishedSession(day.sessions) : null);

            return (
              <PlanWeekDay
                key={day.date}
                href={
                  sessionToView === null
                    ? undefined
                    : trainSessionDetailPath(sessionToView.id, "train")
                }
                accessibleName={copy.accessibleName}
                isToday={day.isToday}
                label={copy.label}
                look={weekDayLookOf(day, hasRoutine)}
                weekday={copy.weekday}
              />
            );
          })}
        </ul>
      </section>
    </Card>
  );
}
