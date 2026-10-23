import { WeightScreen } from "../../../../components/WeightScreen";

// Pushed inside the More tab from the Weight row. The root layout's AuthGate covers it, and the stack above
// gives it no header.
export default function WeightRoute() {
  return <WeightScreen />;
}
