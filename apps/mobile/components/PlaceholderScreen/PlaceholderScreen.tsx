import { COMING_SOON_TITLE } from "@keylow/core/copy";
import { View } from "react-native";

import { ScreenHeader } from "../ScreenHeader";
import { EmptyState } from "../ui";

import type { PlaceholderScreenProps } from "./types";

/**
 * A tab whose content is not built yet, as the tab shell boards draw it: the screen's heading, and the
 * kit's empty state saying "Coming soon" in the middle of what is left. The boards give the empty state
 * 32 points at its sides, a 300 point sentence and 48 points under it, which the kit's own 24 at the sides
 * is brought to here.
 */
export function PlaceholderScreen({ title, icon, body }: PlaceholderScreenProps) {
  return (
    <View className="flex-1">
      <ScreenHeader title={title} />
      <View className="flex-1 items-center px-2 pb-12">
        {/* The kit's empty state brings 24 points of padding, so 348 is its 300 point sentence. */}
        <View className="w-full max-w-[348px] flex-1">
          <EmptyState body={body} icon={icon} title={COMING_SOON_TITLE} />
        </View>
      </View>
    </View>
  );
}
