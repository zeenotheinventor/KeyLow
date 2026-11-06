import { PROGRAM_SCREEN } from "@keylow/core/copy";

import type { YourProgrammeProps } from "./types";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";

/**
 * The "Your programme" group: the goal, the rate, the protein and the diet style the programme was set up
 * with, as information rows with a value and no chevron, because none of them opens anything yet.
 */
export function YourProgramme({ rows }: YourProgrammeProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <GroupedList title={PROGRAM_SCREEN.details.title}>
      {rows.map((row) => (
        <ListRow key={row.key} title={row.title} subtitle={row.subtitle} value={row.value} />
      ))}
    </GroupedList>
  );
}
