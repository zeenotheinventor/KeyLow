import { Pressable, Text } from "react-native";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";
import { supabase } from "../../lib/supabase";

export default function SettingsRoute() {
  return (
    <PlaceholderScreen title="Settings">
      <Pressable
        accessibilityRole="button"
        onPress={() => void supabase.auth.signOut()}
        className="h-12 items-center justify-center rounded-lg bg-brand-600 px-6"
      >
        <Text className="text-base font-semibold text-neutral-50">Sign out</Text>
      </Pressable>
    </PlaceholderScreen>
  );
}
