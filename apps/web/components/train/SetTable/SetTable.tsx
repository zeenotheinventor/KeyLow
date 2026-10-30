import { SESSION_ACTIVE } from "@keylow/core/copy";

import { SetTableRow } from "./SetTableRow";

import type { SetTableProps } from "./types";

const headingClasses = "text-caption font-medium text-text-muted";

/**
 * An exercise's sets as the `web-session · active` board draws them: a table with the set, the same set
 * last time, the load, the reps and the RIR, and the check in a column whose heading only a screen reader
 * hears. A logged set's numbers are text. A set still to log has its three numbers as fields in the row,
 * with the sentences for any rule they break under it, so the table is the whole entry: nothing opens. The
 * screen holds what is typed and what the check does.
 */
export function SetTable({ columns, rows }: SetTableProps) {
  return (
    <table aria-label={SESSION_ACTIVE.setsListName} className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-11 md:w-14" />
        <col className="w-[68px] md:w-24" />
        <col />
        <col />
        <col />
        <col className="w-12 md:w-[60px]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={`${headingClasses} py-1 pl-3 text-left md:px-4`}>
            {columns.set}
          </th>
          <th scope="col" className={`${headingClasses} text-left`}>
            {columns.previous}
          </th>
          <th scope="col" className={headingClasses}>
            {columns.load}
          </th>
          <th scope="col" className={headingClasses}>
            {columns.reps}
          </th>
          <th scope="col" className={headingClasses}>
            {columns.rir}
          </th>
          <th scope="col" className={`${headingClasses} pr-3 md:pr-4`}>
            <span className="sr-only">{SESSION_ACTIVE.loggedColumnName}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <SetTableRow key={row.key} row={row} />
        ))}
      </tbody>
    </table>
  );
}
