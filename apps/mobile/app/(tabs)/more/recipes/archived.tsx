import { ArchivedRecipesScreen } from "../../../../components/ArchivedRecipesScreen";

// Pushed inside the More tab from the library's Archived recipes row. The root layout's AuthGate covers
// it, and the stack above gives it no header.
export default function ArchivedRecipesRoute() {
  return <ArchivedRecipesScreen />;
}
