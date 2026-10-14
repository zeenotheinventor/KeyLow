import { View } from "react-native";

import { ScreenHeader } from "../../components/ScreenHeader";
import { Button } from "../../components/ui";
import { supabase } from "../../lib/supabase";

// Holds Sign out until Settings is built with More (KEY-111).
export default function SettingsRoute() {
  return (
    <View className="flex-1">
      <ScreenHeader title="Settings" />
      <View className="items-start px-4 pt-1">
        <Button variant="secondary" onPress={() => void supabase.auth.signOut()}>
          Sign out
        </Button>
      </View>
    </View>
  );
}
