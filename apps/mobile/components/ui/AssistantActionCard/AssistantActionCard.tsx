import { useState } from "react";
import { View } from "react-native";

import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";
import { AssistantLinkRow } from "./AssistantLinkRow";
import { RoutineDayRow } from "./RoutineDayRow";

import type {
  AssistantActionCardProps,
  AssistantActionCardRow,
  AssistantActionCardUndo,
} from "./types";

/**
 * What the assistant did, as a card in the thread: an icon tile, a title and its Undo, then the entries
 * it made, the days of a routine it built, a total, a note and a link to what it made. The days open one at
 * a time, and the card holds which. Every word and every amount is the caller's and is drawn exactly as given. The Undo is the diary toast's action: the accent ink, 36 points high. The
 * card stays in the thread after an Undo, with the title muted and no action, so the history reads true.
 */
export function AssistantActionCard({
  icon,
  iconTone = "success",
  title,
  subtitle,
  rows = [],
  days = [],
  initiallyOpenDay,
  total,
  note,
  link,
  lead,
  footer,
  undo,
}: AssistantActionCardProps) {
  const [openDayIndex, setOpenDayIndex] = useState(initiallyOpenDay);

  return (
    // The board draws the card flat, as the notice is, so this is Card's surface without its elevation.
    <View className="overflow-hidden rounded-large border border-border bg-surface">
      <View className="flex-row items-center gap-3 p-3">
        <View className="h-9 w-9 shrink-0 items-center justify-center rounded-small bg-surface-raised">
          <Icon name={icon} tone={iconTone} />
        </View>
        <View className="min-w-0 flex-1 gap-[2px]">
          <Text tone={undo?.state === "done" ? "secondary" : "primary"} variant="body-strong">
            {title}
          </Text>
          {subtitle === undefined ? null : (
            <Text tone="muted" variant="caption">
              {subtitle}
            </Text>
          )}
        </View>
        {undo === undefined ? null : <UndoAction undo={undo} />}
      </View>
      {lead}
      {rows.map((row, index) => (
        <Row key={`${index}-${row.name}`} row={row} />
      ))}
      {days.map((day, index) => (
        <RoutineDayRow
          key={`${index}-${day.name}`}
          day={day}
          isOpen={openDayIndex === index}
          onPress={() => {
            setOpenDayIndex(openDayIndex === index ? undefined : index);
          }}
        />
      ))}
      {total === undefined ? null : (
        <View className="border-t border-border bg-surface-raised px-3 py-[10px]">
          <Text tone="secondary" variant="caption">
            {total}
          </Text>
        </View>
      )}
      {note === undefined ? null : (
        <View className="border-t border-border px-3 py-[10px]">
          <Text tone="secondary" variant="caption">
            {note}
          </Text>
        </View>
      )}
      {link === undefined ? null : <AssistantLinkRow label={link.label} onPress={link.onPress} />}
      {footer}
    </View>
  );
}

function UndoAction({ undo }: { undo: AssistantActionCardUndo }) {
  if (undo.state === "done") {
    return null;
  }
  if (undo.state === "unavailable") {
    return (
      <Text className="shrink-0 px-2" tone="muted" variant="caption">
        {undo.label}
      </Text>
    );
  }
  // The action is the diary toast's: 36 points high, 12 across, the label in the accent ink at 14 over 20
  // semibold.
  return (
    <PressableSurface
      busy={undo.state === "busy"}
      className="h-control-sm shrink-0 justify-center rounded-small px-3"
      label={undo.label}
      onPress={undo.onPress}
    >
      <Text tone="accent-ink" variant="label-small">
        {undo.label}
      </Text>
    </PressableSurface>
  );
}

function Row({ row }: { row: AssistantActionCardRow }) {
  const isUnresolved = row.match === "unresolved";

  return (
    <View className="flex-row items-center gap-3 border-t border-border px-3 py-2">
      <View className="min-w-0 flex-1">
        <Text>{row.name}</Text>
        <View className="flex-row flex-wrap items-center gap-[6px]">
          <Text tone={isUnresolved ? "warning-ink" : "muted"} variant="caption">
            {row.detail}
          </Text>
          {row.estimateLabel === undefined ? null : <Badge outlined>{row.estimateLabel}</Badge>}
        </View>
      </View>
      {row.value === undefined ? null : (
        <Text className="shrink-0" tone="secondary">
          {row.value}
        </Text>
      )}
      {row.match === "matched" ? (
        <Icon label={row.matchLabel} name="Check" size="sm" tone="success" />
      ) : null}
      {isUnresolved ? (
        // The badge is `self-start`, so the wrapper lets the row centre it, as a list row does.
        <View className="shrink-0">
          <Badge tone="warning">{row.matchLabel}</Badge>
        </View>
      ) : null}
    </View>
  );
}
