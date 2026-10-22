import { REMINDERS_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReminderSwitchRow } from "./ReminderSwitchRow";
import { useReminderPermission } from "./useReminderPermission";
import { useReminderSettings } from "../../lib/reminderSettings";
import { Banner, GroupedList, SheetHeader, Text, TimePicker, TimeRow } from "../ui";

import type { SwitchKey } from "./types";

// The switch of each reminder, by its type.
const switchKeys = {
  train: "trainEnabled",
  progress: "progressEnabled",
  ease: "easeEnabled",
} as const satisfies Record<(typeof REMINDERS_SCREEN.reminders)[number]["type"], SwitchKey>;

/**
 * The Reminders screen, pushed from More: a switch for each of the three training reminders, and the time
 * of the train one. The first switch turned on asks for the permission to show notifications. If it is
 * refused, or was before, the switch stays off and a notice says how to allow them in the phone's
 * settings, with a button that opens them. On a build that cannot show notifications the switches are
 * disabled and a notice says a newer version must be installed. Changes apply at once and are kept by the
 * settings, which the scheduler at the root reads. No board draws this screen.
 */
export function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useReminderSettings();
  const { permission, askForPermission } = useReminderPermission();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  async function changeSwitch(key: SwitchKey, isOn: boolean) {
    try {
      if (!isOn) {
        await update({ [key]: false });
      } else if (await askForPermission()) {
        await update({ [key]: true });
      }
    } catch {
      // The switch stays as it was. Nothing about the failure is reported, since it can quote the settings.
    }
  }

  const isUnavailable = permission === "unavailable";

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: REMINDERS_SCREEN.back, onPress: goBack }}
        title={REMINDERS_SCREEN.title}
        variant="stack"
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
        {permission === "denied" ? (
          <Banner
            action={{
              label: REMINDERS_SCREEN.denied.action,
              onPress: () => {
                // A phone that cannot open its settings rejects, and there is nothing else to do about it.
                Linking.openSettings().catch(() => undefined);
              },
            }}
            body={REMINDERS_SCREEN.denied.body}
            title={REMINDERS_SCREEN.denied.title}
          />
        ) : null}
        {isUnavailable ? (
          <Banner
            body={REMINDERS_SCREEN.unavailable.body}
            title={REMINDERS_SCREEN.unavailable.title}
          />
        ) : null}
        <GroupedList hidesTitle title={REMINDERS_SCREEN.listName}>
          {REMINDERS_SCREEN.reminders.map(({ type, title, helper }) => (
            <ReminderSwitchRow
              key={type}
              disabled={isUnavailable}
              helper={helper}
              isOn={settings[switchKeys[type]]}
              title={title}
              onValueChange={(isOn) => {
                void changeSwitch(switchKeys[type], isOn);
              }}
            />
          ))}
        </GroupedList>
        <View className="gap-2">
          <Text className="px-1" role="heading" tone="muted" variant="caption">
            {REMINDERS_SCREEN.timeHeading}
          </Text>
          <TimeRow
            open={isPickerOpen}
            time={settings.trainTime}
            onPress={() => {
              setIsPickerOpen(true);
            }}
          />
        </View>
      </ScrollView>
      <TimePicker
        open={isPickerOpen}
        value={settings.trainTime}
        onChange={(trainTime) => {
          void update({ trainTime });
        }}
        onClose={() => {
          setIsPickerOpen(false);
        }}
      />
    </View>
  );
}
