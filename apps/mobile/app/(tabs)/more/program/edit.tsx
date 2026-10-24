import { ProgramEditScreen } from "../../../../components/ProgramEditScreen";

// Pushed inside the More tab from the Edit programme row of the Programme screen. The root layout's AuthGate
// covers it, and the stack above gives it no header.
export default function ProgramEditRoute() {
  return <ProgramEditScreen />;
}
