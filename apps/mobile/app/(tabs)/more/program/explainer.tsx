import { useProgramSummary } from "@keylow/api-client";
import { Redirect, Stack, useRouter } from "expo-router";

import { ProgramExplainerSheet } from "../../../../components/ProgramExplainerSheet";
import { useReadsEnabled } from "../../../../lib/useReadsEnabled";

// The sheet that explains the programme, pushed over the Programme screen and drawn above it: the screen is a
// transparent modal that fades in, so the sheet's own dim covers the Programme screen, which stays on show
// behind it, as the trend explainer's route does. Its presentation is set here and not in the stack's layout,
// which holds none of the screens' options.

// Closes the sheet. A link can open it cold, with nothing behind it, and going back would then throw, so it
// replaces itself with the Programme screen, as the other screens a link can open do.
function useCloseExplainer() {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/program");
    }
  };
}

export default function ProgramExplainerRoute() {
  const close = useCloseExplainer();
  const summary = useProgramSummary({ enabled: useReadsEnabled() });
  const program = summary.data?.program;

  // The row that opens this is on a screen that holds the programme, so it is read. A cold link with none, or
  // one that cannot be read, goes to the Programme screen, which says what is wrong. Nothing is drawn meanwhile.
  // A failed refetch keeps the programme the sheet already shows, so only a read with nothing to draw leaves.
  const isLeaving = program === null || (summary.isError && program === undefined);

  return (
    <>
      {/* Set on every render, so a cold link is a transparent modal from its first frame and not a card that flips. */}
      <Stack.Screen
        options={{
          presentation: "transparentModal",
          animation: "fade",
          // The stack paints every screen on the background colour. A transparent modal sets none of its own,
          // so clearing the stack's lets the Programme screen show through the sheet's dim.
          contentStyle: undefined,
        }}
      />
      {isLeaving ? <Redirect href="/more/program" /> : null}
      {/* The check-in day is the weekday the programme set up on, which its schedule keeps: the next check-in's, or the start's before one is set. */}
      {program === undefined || program === null ? null : (
        <ProgramExplainerSheet
          open
          checkInDate={program.nextCheckinDate ?? program.startedOn}
          onClose={close}
        />
      )}
    </>
  );
}
