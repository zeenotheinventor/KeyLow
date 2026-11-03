import { AssistantSettingsScreen } from "../../../../components/AssistantSettingsScreen";

// Pushed inside the More tab from the Assistant row. The root layout's AuthGate covers it, and the stack above
// gives it no header.
export default function AssistantSettingsRoute() {
  return <AssistantSettingsScreen />;
}
