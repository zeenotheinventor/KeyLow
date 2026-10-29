import { ShoppingListScreen } from "../../components/ShoppingListScreen";

// A standard stack push outside the tabs group, so the tab bar is hidden, as the recipe view's is. It is
// opened from the recipe library's header. The root layout's AuthGate covers it and the root stack gives it
// no header.
export default function ShoppingListRoute() {
  return <ShoppingListScreen />;
}
