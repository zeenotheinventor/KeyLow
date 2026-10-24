import { PROGRAM_SETTLING } from "@keylow/core/copy";
import { View } from "react-native";

import { useSettlingChecklist } from "./useSettlingChecklist";
import { Banner, Icon, SettlingProgressBar, Text } from "../../ui";

import type { SettlingChecklistProps } from "./types";

/**
 * What the first check-in needs, as `program: settling` draws it under the hero: the compact warning banner with the
 * first check-in's date, the three counts as bars and, while it can still help, the tip about the day to weigh in.
 * It draws nothing until its reads have answered, since a count of 0 would be wrong, not empty.
 */
export function SettlingChecklist(props: SettlingChecklistProps) {
  const view = useSettlingChecklist(props);

  if (view === null) {
    return null;
  }

  return (
    <Banner
      body={PROGRAM_SETTLING.intro}
      hasIcon={false}
      size="compact"
      title={view.title}
      variant="review"
    >
      {/* The board leaves 12 between the words, each bar and the tip. The banner's slot leaves 8 under the words. */}
      <View className="gap-3 pt-1">
        {view.rows.map((row) => (
          <SettlingProgressBar
            key={row.name}
            count={row.count}
            label={row.label}
            name={row.name}
            target={row.target}
          />
        ))}
        {view.tip === null ? null : (
          <View className="flex-row gap-[6px]">
            <View className="pt-[1px]">
              <Icon name="Info" size={14} tone="secondary" />
            </View>
            <Text className="min-w-0 flex-1 tabular-nums" tone="secondary" variant="caption">
              {view.tip}
            </Text>
          </View>
        )}
      </View>
    </Banner>
  );
}
