import { RoutineEditor } from "../../../../components/RoutineEditor";

// Pushed inside the Train tab, over the routines list. Nothing links to it yet: the routine editor's save
// ticket adds the Create routine controls. The root layout's AuthGate covers it, and the stack above gives
// it no header.
export default function NewRoutineRoute() {
  return <RoutineEditor />;
}
