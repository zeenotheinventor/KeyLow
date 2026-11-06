"use client";

import { useProgramSummary } from "@keylow/api-client";
import { PROGRAM_SCREEN } from "@keylow/core/copy";
import { programCheckInDate } from "@keylow/core/program";
import { Info, Pencil } from "lucide-react";
import { useState } from "react";

import { ProgramExplainerDialog } from "../../ProgramExplainerDialog";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";
import { useIsOnline } from "@/lib/useIsOnline";

const EDIT_HREF = "/more/program/edit";

/**
 * The card of the programme's own actions, named Programme and with no heading, as the boards draw it: Edit
 * programme, a link to its page that is off while offline because a save needs a connection, and How it works,
 * which opens the explainer and reads no network of its own, so it stays on offline. The explainer names the
 * weekday of the check-in, which the programme's schedule keeps: the next check-in's day, or the start's
 * before one is set. That is the summary the page already holds, so the row waits for it and is left out
 * where there is none.
 */
export function ProgramActionsCard() {
  const program = useProgramSummary({ enabled: true }).data?.program;
  const isOnline = useIsOnline();
  // The row that opened the explainer, kept for the way back: a click does not focus a button in every browser.
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);

  if (program === undefined || program === null) {
    return null;
  }

  return (
    <>
      <GroupedList hidesTitle title={PROGRAM_SCREEN.title}>
        <ListRow
          icon={Pencil}
          title={PROGRAM_SCREEN.editLabel}
          href={EDIT_HREF}
          disabled={!isOnline}
        />
        <ListRow
          icon={Info}
          title={PROGRAM_SCREEN.howItWorksLabel}
          onClick={(event) => {
            setOpener(event.currentTarget);
          }}
        />
      </GroupedList>
      {opener !== null && (
        <ProgramExplainerDialog
          checkInDate={programCheckInDate(program)}
          returnFocusTo={opener}
          onClose={() => {
            setOpener(null);
          }}
        />
      )}
    </>
  );
}
