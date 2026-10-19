import { RoutinesScreen } from "../../../components/RoutinesScreen";

// Pushed inside the Train tab, from the Routines link of the Train home. The root layout's AuthGate covers
// it, and the stack above gives it no header.
export default function RoutinesRoute() {
  return <RoutinesScreen />;
}
