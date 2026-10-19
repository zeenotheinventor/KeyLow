import { useLocalSearchParams } from "expo-router";

import { RoutineEditorScreen } from "../../../../components/RoutineEditorScreen";

// Pushed inside the Train tab, over the routines list. Nothing links to it yet: the routine editor's save
// ticket adds the Edit routine controls. The static segments beside it (`archived`, `new`) win over this
// dynamic one. The root layout's AuthGate covers it, and the stack above gives it no header.
export default function EditRoutineRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <RoutineEditorScreen id={id} />;
}
