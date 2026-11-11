import { FeatureRequestScreen } from "../../../components/FeatureRequestScreen";

// Pushed inside the More tab from the Request a feature row. The root layout's AuthGate covers it, and the
// stack above gives it no header.
export default function FeatureRequestRoute() {
  return <FeatureRequestScreen />;
}
