import { colors } from "@keylow/tokens";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { describeInvalidReason, describeRateLimit } from "./describeScanProblem";

import type { ScanResultProps } from "./types";

function ScanAgainButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-12 items-center justify-center rounded-lg border border-neutral-300"
    >
      <Text className="text-base font-semibold text-neutral-900">Scan again</Text>
    </Pressable>
  );
}

function Progress({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-center justify-center gap-3 py-8"
    >
      <ActivityIndicator color={colors.brand["600"]} />
      <Text className="text-base text-neutral-900">{message}</Text>
    </View>
  );
}

export function ScanResult({ outcome, onScanAgain, onCreateFood }: ScanResultProps) {
  switch (outcome.status) {
    case "looking_up":
      return <Progress message="Looking up the barcode" />;
    case "opening_food":
      return <Progress message="Opening the food" />;
    case "not_found":
      return (
        <View className="gap-4 px-6 py-6">
          <View className="gap-1">
            <Text accessibilityRole="header" className="text-2xl font-semibold text-neutral-900">
              Not in the database
            </Text>
            <Text className="text-base text-neutral-500">{outcome.code}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onCreateFood(outcome.code);
            }}
            className="h-12 items-center justify-center rounded-lg bg-brand-600"
          >
            <Text className="text-base font-semibold text-neutral-50">
              Create food with this barcode
            </Text>
          </Pressable>
          <ScanAgainButton onPress={onScanAgain} />
        </View>
      );
    case "invalid":
      return (
        <View className="gap-4 px-6 py-6">
          <View className="gap-1">
            <Text accessibilityRole="header" className="text-2xl font-semibold text-neutral-900">
              Barcode not recognised
            </Text>
            <Text className="text-base text-neutral-900">
              {describeInvalidReason(outcome.reason)}
            </Text>
            <Text className="text-base text-neutral-500">
              Hold the camera steady and scan again.
            </Text>
          </View>
          <ScanAgainButton onPress={onScanAgain} />
        </View>
      );
    case "rate_limited":
      return (
        <View className="gap-4 px-6 py-6">
          <Text accessibilityRole="alert" className="text-base text-danger-600">
            {describeRateLimit(outcome.retryAfterSeconds)}
          </Text>
          <ScanAgainButton onPress={onScanAgain} />
        </View>
      );
    case "failed":
      return (
        <View className="gap-4 px-6 py-6">
          <Text accessibilityRole="alert" className="text-base text-danger-600">
            The barcode could not be looked up. Check your connection and try again.
          </Text>
          <ScanAgainButton onPress={onScanAgain} />
        </View>
      );
  }
}
