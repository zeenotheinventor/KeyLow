import { BodyMapScreen } from "../components/BodyMapScreen";

// A standard stack push over the tabs, opened from the dashboard card. The root layout's AuthGate covers it
// and the root stack gives it no header.
export default function BodyMapRoute() {
  return <BodyMapScreen />;
}
