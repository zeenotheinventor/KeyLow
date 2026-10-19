import { RoutinesScreen } from "../../../components/RoutinesScreen";

// Pushed inside the Train tab. Nothing links to it yet: the routine editor's save ticket adds the Routines
// link to the Train home. The root layout's AuthGate covers it, and the stack above gives it no header.
export default function RoutinesRoute() {
  return <RoutinesScreen />;
}
