import { TAB_TITLES } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { ScreenHeader } from "../../components/ScreenHeader";
import { GroupedList, ListRow } from "../../components/ui";

// Two rows that open the screens More will replace (KEY-111). They keep Weight and Sign out reachable.
export default function MoreRoute() {
  const router = useRouter();

  return (
    <View className="flex-1">
      <ScreenHeader title={TAB_TITLES.more} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
        <GroupedList title="Body">
          <ListRow
            title="Weight"
            onPress={() => {
              router.push("/weight");
            }}
          />
        </GroupedList>
        <GroupedList title="Settings">
          <ListRow
            title="Settings"
            onPress={() => {
              router.push("/settings");
            }}
          />
        </GroupedList>
      </ScrollView>
    </View>
  );
}
