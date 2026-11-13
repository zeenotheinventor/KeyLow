import { FoodsToAvoidScreen } from "../../../../components/FoodsToAvoidScreen";

// Pushed inside the More tab from the Your food group of the Assistant settings. The root layout's AuthGate
// covers it, and the stack above gives it no header.
export default function FoodsToAvoidRoute() {
  return <FoodsToAvoidScreen />;
}
