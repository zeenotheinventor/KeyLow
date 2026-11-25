import { DeleteAccountScreen } from "../../../components/DeleteAccountScreen";

// Pushed inside the More tab from the Delete account row. The root layout's AuthGate covers it, and the stack
// above gives it no header.
export default function DeleteAccountRoute() {
  return <DeleteAccountScreen />;
}
