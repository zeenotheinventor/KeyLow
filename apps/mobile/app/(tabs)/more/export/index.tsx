import { ExportMyDataScreen } from "../../../../components/ExportMyDataScreen";

// Pushed inside the More tab from the Export my data row. The root layout's AuthGate covers it, and the stack
// above gives it no header.
export default function ExportMyDataRoute() {
  return <ExportMyDataScreen />;
}
