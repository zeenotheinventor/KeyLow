import { useState } from "react";
import { View } from "react-native";

import { BottomSheet, Button, Card, SheetHeader, SheetScrollView, Text } from "../../ui";
import { SuggestionExerciseRow } from "../SuggestionExerciseRow";

import type { SuggestionDetailSheetProps } from "./types";

// The session is up to a dozen rows with the summary over them, which a short phone scrolls.
const SNAP_POINTS = ["90%"];

/**
 * The whole suggested session with its reasons, as the `suggestion · detail` board draws it: the day, the
 * headline and the length, a row for each exercise with its target and where it came from, the footnote, and
 * Not now and Add under them. The sheet's own scroll view is the only scrollable, so its drag and the list's
 * scroll do not fight (KEY-747). Every word is core's, given in the offer's `detail`. Add does what the card's
 * does and closes the sheet, and a failure shows as the toast at the top, since the card keeps the offer to
 * try again from. For today's suggestion the button is Start, which is the card's too: it closes the sheet and
 * the app opens the session.
 */
export function SuggestionDetailSheet({
  open,
  offer,
  onClose,
  onDismiss,
}: SuggestionDetailSheetProps) {
  // The offer is kept while it closes, so the sheet that is sliding away still shows what it held.
  const [lastOffer, setLastOffer] = useState(offer);
  if (offer !== undefined && offer !== lastOffer) {
    setLastOffer(offer);
  }
  const shown = offer ?? lastOffer;
  const detail = shown?.detail;
  if (shown === undefined || detail === undefined) {
    return null;
  }
  // Add for a day to come, Start for today: one primary button, whose handler is the one the offer holds.
  const primary = shown.accept ?? shown.start;

  return (
    <BottomSheet label={detail.title} open={open} snapPoints={SNAP_POINTS} onClose={onClose}>
      {/* The header brings its own 16 points across, as the sheet does, so it is pulled out to the sheet's edge. */}
      <View className="-mx-4">
        <SheetHeader
          leading={{ icon: "ChevronLeft", label: detail.backLabel, onPress: onClose }}
          title={detail.title}
          variant="stack"
        />
      </View>
      <SheetScrollView className="flex-1" contentContainerClassName="gap-3 pb-4">
        <Card>
          <View className="gap-1">
            <Text tone="muted" variant="caption">
              {detail.dayLine}
            </Text>
            <Text role="heading" variant="h2">
              {detail.headline}
            </Text>
            <Text tone="secondary" variant="caption">
              {detail.loadLine}
            </Text>
          </View>
        </Card>
        <Card padding={0}>
          <View aria-label={detail.listName} role="list">
            {/* The rows are a static list, and a day can hold one exercise twice, so a name is no key. */}
            {detail.rows.map((row, position) => (
              <SuggestionExerciseRow key={position} hasDivider={position > 0} row={row} />
            ))}
          </View>
        </Card>
        <Text tone="muted" variant="caption">
          {detail.footnote}
        </Text>
      </SheetScrollView>
      <View className="flex-row gap-2 border-t border-border pt-3">
        <Button
          accessibilityLabel={detail.dismissActionName}
          className="flex-1"
          variant="secondary"
          onPress={() => {
            onDismiss(shown.day);
            onClose();
          }}
        >
          {detail.dismissAction}
        </Button>
        {primary === undefined ? null : (
          <Button
            accessibilityLabel={detail.primaryActionName}
            className="flex-[2]"
            loading={shown.isAccepting}
            onPress={() => {
              primary();
              onClose();
            }}
          >
            {detail.primaryAction}
          </Button>
        )}
      </View>
    </BottomSheet>
  );
}
