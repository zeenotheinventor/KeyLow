import { useLocalSearchParams } from "expo-router";

import { EntryScreen } from "../../components/EntryScreen";

// A standard stack push over the tabs, opened from a diary row. The root layout's AuthGate covers it and the
// root stack gives it no header.
export default function EntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <EntryScreen id={id} />;
}
