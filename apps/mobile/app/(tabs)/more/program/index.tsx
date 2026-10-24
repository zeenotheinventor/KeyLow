import { ProgramScreen } from "../../../../components/ProgramScreen";

// Pushed inside the More tab from the Programme row. The root layout's AuthGate covers it, and the stack above
// gives it no header.
export default function ProgramRoute() {
  return <ProgramScreen />;
}
