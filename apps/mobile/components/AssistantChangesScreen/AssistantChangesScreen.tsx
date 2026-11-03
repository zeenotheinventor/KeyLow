import { useAssistantChanges } from "@keylow/api-client";
import { ASSISTANT_CHANGES } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssistantChangeRow } from "./AssistantChangeRow";
import { EmptyState, GroupedList, SheetHeader, Text } from "../ui";

/**
 * "What the assistant changed", pushed from the Assistant settings (`assistant-settings · changes` and
 * `changes-empty`): one group for each day, newest first, with a row for each card the assistant drew, and
 * the footer about when Undo works. With no rows it is the empty state alone. Until the list is read only
 * the header is drawn, since no board draws a loading or a failed read.
 */
export function AssistantChangesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const changes = useAssistantChanges();

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Assistant settings instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/assistant");
    }
  }

  function renderBody() {
    if (changes.data === undefined) {
      return null;
    }
    const { days } = changes.data;
    if (days.length === 0) {
      return (
        <EmptyState
          body={ASSISTANT_CHANGES.emptyBody}
          icon="RotateCcw"
          title={ASSISTANT_CHANGES.emptyTitle}
        />
      );
    }
    return (
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6 pt-1">
        {days.map((day) => (
          <GroupedList key={day.label} title={day.label}>
            {day.rows.map((row) => (
              <AssistantChangeRow key={row.key} row={row} />
            ))}
          </GroupedList>
        ))}
        <View className="px-1">
          <Text tone="muted" variant="caption">
            {ASSISTANT_CHANGES.footer}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        isTitleAtStart
        leading={{ icon: "ChevronLeft", label: ASSISTANT_CHANGES.back, onPress: goBack }}
        title={ASSISTANT_CHANGES.title}
      />
      {renderBody()}
    </View>
  );
}
