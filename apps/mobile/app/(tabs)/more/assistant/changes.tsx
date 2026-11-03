import { AssistantChangesScreen } from "../../../../components/AssistantChangesScreen";

// Pushed inside the More tab from the Assistant settings' What the assistant changed row. The root layout's
// AuthGate covers it, and the stack above gives it no header.
export default function AssistantChangesRoute() {
  return <AssistantChangesScreen />;
}
