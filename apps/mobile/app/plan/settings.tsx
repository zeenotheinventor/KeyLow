import { PlanSettingsScreen } from "../../components/PlanSettingsScreen";

// A standard stack push over the Plan screen. The root layout's AuthGate covers it and the root stack gives it no header.
export default function PlanSettingsRoute() {
  return <PlanSettingsScreen />;
}
