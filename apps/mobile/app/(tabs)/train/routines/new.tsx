import { RoutineEditor } from "../../../../components/RoutineEditor";

// Pushed inside the Train tab, from Create routine on the routines list and on the Train home. The root
// layout's AuthGate covers it, and the stack above gives it no header.
export default function NewRoutineRoute() {
  return <RoutineEditor />;
}
