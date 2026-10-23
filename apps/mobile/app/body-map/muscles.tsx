import { MuscleListScreen } from "../../components/MuscleListScreen";

// A standard stack push over the body map, opened from its Muscle list row. The root layout's AuthGate covers it
// and the root stack gives it no header.
export default function MuscleListRoute() {
  return <MuscleListScreen />;
}
