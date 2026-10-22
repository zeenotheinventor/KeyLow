import { RemindersScreen } from "../components/RemindersScreen";

// A standard stack push over the tabs. The root layout's AuthGate covers it and the root stack gives it no header.
export default function RemindersRoute() {
  return <RemindersScreen />;
}
