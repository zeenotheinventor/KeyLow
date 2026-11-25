import { ChangePasswordScreen } from "../../../components/ChangePasswordScreen";

// Pushed inside the More tab from the Change password row. The root layout's AuthGate covers it, and the stack
// above gives it no header.
export default function ChangePasswordRoute() {
  return <ChangePasswordScreen />;
}
