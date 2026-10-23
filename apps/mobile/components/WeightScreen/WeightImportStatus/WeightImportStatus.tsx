import { WEIGHT_IMPORT_STATUS, describeLastImport } from "@keylow/core/copy";
import { Pressable, Text as NativeText } from "react-native";

import { Text } from "../../ui";

import type { WeightImportStatusProps } from "./types";

const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * The words beside the Weigh-ins heading, in one of three looks: "Checking for new readings" while an import
 * runs, "Health Connect · updated 2 min ago" once connected and imported, and where Health Connect is not
 * connected a quiet link, Connect Health Connect, that opens the permission flow. Anything else draws nothing.
 * The link is 44 points high and drawn 12 points up and down into the space around it, so it does not make
 * the heading's row taller, as the board draws it.
 */
export function WeightImportStatus({
  connection,
  isImporting,
  lastImportedAt,
  now,
  onConnect,
}: WeightImportStatusProps) {
  if (isImporting) {
    return (
      <Text tone="muted" variant="caption">
        {WEIGHT_IMPORT_STATUS.checking}
      </Text>
    );
  }
  if (connection === "not-connected") {
    return (
      <Pressable
        className="-mx-1 -my-3 min-h-touch-target justify-center px-1"
        role="link"
        onPress={onConnect}
      >
        <NativeText className="text-caption font-semibold tabular-nums text-accent-ink">
          {WEIGHT_IMPORT_STATUS.connect}
        </NativeText>
      </Pressable>
    );
  }
  if (connection === "connected" && lastImportedAt !== null) {
    const minutesAgo = Math.max(
      0,
      Math.floor((now.getTime() - Date.parse(lastImportedAt)) / MILLISECONDS_PER_MINUTE),
    );

    return (
      <Text tone="muted" variant="caption">
        {describeLastImport(minutesAgo)}
      </Text>
    );
  }
  return null;
}
