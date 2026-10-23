import { useWeighIns } from "@keylow/api-client";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { WeighInSheet } from "../../../../components/WeighInSheet";
import { useReadsEnabled } from "../../../../lib/useReadsEnabled";

import type { WeighIn } from "@keylow/api-client";

// The sheet that adds a weigh-in, or with `id` opens one from the list, pushed over the Weight screen and
// drawn above it: the screen is a transparent modal that fades in, so the sheet's own dim covers Weight,
// which stays on show behind it. Its presentation is set here and not in the stack's layout, which holds none
// of the screens' options.

// Closes the sheet. A link can open it cold, with nothing behind it, and going back would then throw, so it
// replaces itself with the Weight screen, as the other screens a link can open do.
function useCloseEntry() {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/weight");
    }
  };
}

function OpenedWeighInSheet({ id }: { id: string }) {
  const close = useCloseEntry();
  const weighIns = useWeighIns({ enabled: useReadsEnabled() });
  // The weigh-in is kept from the first time the list holds it. A delete takes it out of the list at once, and
  // the sheet must stay on show until it closes, not mistake the missing row for an id that never existed.
  const [opened, setOpened] = useState<WeighIn | undefined>(undefined);
  const found = weighIns.data?.find((weighIn) => weighIn.id === id);

  if (opened === undefined && found !== undefined) {
    setOpened(found);
  }
  if (opened !== undefined) {
    return <WeighInSheet open weighIn={opened} onClose={close} />;
  }
  // An id the list does not hold, or a list that cannot be read, goes to the Weight screen, which says which.
  if (weighIns.data !== undefined || weighIns.isError) {
    return <Redirect href="/more/weight" />;
  }
  return null;
}

function AddWeighInSheet() {
  return <WeighInSheet open onClose={useCloseEntry()} />;
}

export default function WeighInEntryRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          presentation: "transparentModal",
          animation: "fade",
          // The stack paints every screen on the background colour. A transparent modal sets none of its own,
          // so clearing the stack's lets Weight show through the sheet's dim.
          contentStyle: undefined,
        }}
      />
      {id === undefined ? <AddWeighInSheet /> : <OpenedWeighInSheet id={id} />}
    </>
  );
}
