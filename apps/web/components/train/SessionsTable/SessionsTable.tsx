import {
  HISTORY_TABLE,
  describeHistoryRow,
  describeHistoryTableRow,
  describeHistoryWeek,
} from "@keylow/core/copy";
import Link from "next/link";

import type { SessionsTableProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { trainSessionDetailPath, trainSessionPath } from "@/lib/trainRoutes";

const headingCell = "py-3 font-medium";
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/**
 * The sessions of the history as the `web-history · list` board draws them: one table of Date, Session, Time,
 * Sets and Muscles, with a heading row over each calendar week that names it and totals it. Below a tablet the
 * card scrolls sideways and keeps the table's width, as the 375 px board does. The session in progress is a row
 * like the others, with In progress for its time. A row's name is a link: it resumes the session in progress,
 * and opens the detail of any other.
 */
export function SessionsTable({ weeks, thisWeekStart }: SessionsTableProps) {
  const { columns } = HISTORY_TABLE;

  return (
    <Card asChild padding="none" className="overflow-x-auto">
      {/* The card scrolls sideways on a phone, so a keyboard needs to reach it. */}
      <section
        aria-label={HISTORY_TABLE.sectionName}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={focusRing}
      >
        <table className="w-full min-w-[560px] border-collapse md:min-w-0">
          <thead>
            <tr className="text-caption text-text-muted">
              <th scope="col" className={`${headingCell} px-4 text-left`}>
                {columns.date}
              </th>
              <th scope="col" className={`${headingCell} text-left`}>
                {columns.session}
              </th>
              <th scope="col" className={`${headingCell} text-right`}>
                {columns.time}
              </th>
              <th scope="col" className={`${headingCell} text-right`}>
                {columns.sets}
              </th>
              <th scope="col" className={`${headingCell} pl-5 text-left`}>
                {columns.muscles}
              </th>
            </tr>
          </thead>
          {weeks.map((week) => {
            const weekCopy = describeHistoryWeek(week, thisWeekStart);

            return (
              <tbody key={week.weekStart}>
                <tr className="border-t border-border">
                  <th scope="rowgroup" colSpan={5} className="px-4 py-2 text-left font-normal">
                    <div className="flex flex-col gap-0.5 text-caption md:flex-row md:items-baseline md:justify-between md:gap-3">
                      <span className="text-text-muted">{weekCopy.name}</span>
                      <span className="tabular-nums text-text-secondary">{weekCopy.total}</span>
                    </div>
                  </th>
                </tr>
                {week.sessions.map((session) => {
                  const input = { localDate: session.local_date, summary: session.summary };
                  const row = describeHistoryTableRow(input);

                  return (
                    <tr key={session.id} className="h-[52px] border-t border-border">
                      <td className="whitespace-nowrap px-4 text-body tabular-nums">{row.date}</td>
                      <td className="text-body-strong text-text-primary">
                        <Link
                          href={
                            row.isInProgress
                              ? trainSessionPath()
                              : trainSessionDetailPath(session.id)
                          }
                          aria-label={describeHistoryRow(input).accessibleName}
                          className={`rounded-small underline ${focusRing}`}
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="text-right text-body tabular-nums">
                        {row.isInProgress ? (
                          <Badge dot tone="accent">
                            {row.time}
                          </Badge>
                        ) : (
                          row.time
                        )}
                      </td>
                      <td className="text-right text-body tabular-nums">{row.sets}</td>
                      <td className="whitespace-nowrap pl-5 text-caption text-text-secondary">
                        {row.muscles}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </section>
    </Card>
  );
}
