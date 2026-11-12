"use client";

import { useProgramSummary } from "@keylow/api-client";
import { MORE_SCREEN, describeNextCheckInSubtitle } from "@keylow/core/copy";

import { ListRow } from "@/components/ui/ListRow";

/**
 * The Programme row of More: it opens the Programme page. Under its title it says the next check-in while a
 * programme runs, or the offer to let Ki-Lo set the targets when there is none. It says nothing until the read
 * is in, and a programme with no check-in date yet has nothing to say. The row is drawn and opens in every state.
 */
export function ProgramRow() {
  const program = useProgramSummary().data?.program;
  const subtitle =
    program === undefined
      ? undefined
      : program === null
        ? MORE_SCREEN.nutrition.program.subtitleWithoutProgram
        : program.nextCheckinDate === null
          ? undefined
          : describeNextCheckInSubtitle(program.nextCheckinDate);

  return (
    <ListRow title={MORE_SCREEN.nutrition.program.title} subtitle={subtitle} href="/more/program" />
  );
}
