import { PROGRAM_SCREEN } from "@keylow/core/copy";

import { GroupedList, ListRow } from "../../ui";

import type { YourProgrammeProps } from "./types";

/**
 * The "Your programme" group: the goal, the rate, the protein and the diet style the program was set up with,
 * as information rows with a value and no chevron, because none of them opens anything yet.
 */
export function YourProgramme({ rows }: YourProgrammeProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <GroupedList title={PROGRAM_SCREEN.details.title}>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          chevron={false}
          subtitle={row.subtitle}
          title={row.title}
          value={row.value}
          valueLook="quiet"
        />
      ))}
    </GroupedList>
  );
}
