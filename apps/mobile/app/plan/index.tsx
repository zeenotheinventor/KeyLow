import { PlanScreen } from "../../components/PlanScreen";

// A standard stack push over the tabs, from the Diary's More sheet, its planned row or a plan card's link. The
// root layout's AuthGate covers it and the root stack gives it no header.
export default function PlanRoute() {
  return <PlanScreen />;
}
