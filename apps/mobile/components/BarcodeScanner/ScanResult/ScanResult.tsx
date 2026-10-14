import {
  BARCODE_LOOKUP_FAILED,
  BARCODE_LOOKUP_PROGRESS,
  BARCODE_NOT_FOUND,
  BARCODE_NOT_RECOGNISED_TITLE,
  BARCODE_SCAN,
  OPEN_FOOD_FACTS_BUSY,
  SCANNED_BARCODE_PROBLEMS,
  describeBarcodeRateLimit,
} from "@keylow/core/copy";
import { View } from "react-native";

import { BarcodeReadCard } from "./BarcodeReadCard";
import { LookupProgress } from "./LookupProgress";
import { ScanMessage } from "./ScanMessage";
import { Banner, Button, ErrorState } from "../../ui";

import type { ScanResultProps } from "./types";
import type { ScanOutcome } from "../types";

function renderOutcome(outcome: ScanOutcome) {
  switch (outcome.status) {
    case "looking_up":
      return <LookupProgress message={BARCODE_LOOKUP_PROGRESS.lookingUp} />;
    case "opening_food":
      return <LookupProgress message={BARCODE_LOOKUP_PROGRESS.openingFood} />;
    case "not_found":
      return <ScanMessage body={BARCODE_NOT_FOUND.scannedBody} title={BARCODE_NOT_FOUND.title} />;
    case "invalid":
      return (
        <ScanMessage
          body={SCANNED_BARCODE_PROBLEMS[outcome.reason]}
          title={BARCODE_NOT_RECOGNISED_TITLE}
        />
      );
    case "rate_limited":
      return (
        <Banner
          body={describeBarcodeRateLimit(outcome.retryAfterSeconds)}
          icon="Clock"
          title={OPEN_FOOD_FACTS_BUSY}
        />
      );
    case "failed":
      // The design draws this error state compact, at 24 points over and 16 at the sides, where the kit's
      // is the roomy one that fills its parent and sits in the middle. The wrapper gives it the compact
      // spacing: the kit's 24 point sides less the 8 that bring them to the design's 32 from the screen edge.
      // It is a row so the kit's fill goes across the width and the height stays the content's: in a column
      // that fill has no height to take, and the words are cut off.
      return (
        <View className="-mx-2 flex-row pt-6">
          <ErrorState body={BARCODE_LOOKUP_FAILED.body} title={BARCODE_LOOKUP_FAILED.title} />
        </View>
      );
  }
}

/**
 * What the screen shows once a scan was accepted: the code that was read, then what became of it, then
 * the actions at the foot. Nothing can be done while the lookup is in flight or the food is opening, so
 * those have none. Every result that ends there offers to scan again, and a code nobody has also offers
 * to create the food. The foot pads itself with the screen's `--inset-bottom` variable.
 */
export function ScanResult({ outcome, code, onScanAgain, onCreateFood }: ScanResultProps) {
  const isWaiting = outcome.status === "looking_up" || outcome.status === "opening_food";

  return (
    <View className="flex-1 gap-4 px-4 pt-2">
      <BarcodeReadCard code={code} />
      {renderOutcome(outcome)}
      <View className="mt-auto gap-2 pb-[var(--inset-bottom)]">
        {outcome.status === "not_found" ? (
          <Button
            fullWidth
            icon="Plus"
            size="lg"
            onPress={() => {
              onCreateFood(outcome.code);
            }}
          >
            {BARCODE_NOT_FOUND.action}
          </Button>
        ) : null}
        {isWaiting ? null : (
          <Button fullWidth icon="RefreshCcw" size="lg" variant="secondary" onPress={onScanAgain}>
            {BARCODE_SCAN.scanAgain}
          </Button>
        )}
      </View>
    </View>
  );
}
