import { useTargets } from "@keylow/api-client";
import { GENERIC_ERROR, RETRY_LABEL, TARGETS_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TargetsForm } from "./TargetsForm";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ErrorState, SheetHeader, Skeleton } from "../ui";

/**
 * The Targets screen, pushed over the tabs from More, the diary's progress bars and the no-target banner:
 * a header with Back, then the form once the stored targets are known. Nothing is read while the terms
 * gate is up. Back, and a save, return to where the user came from.
 */
export function TargetsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const targets = useTargets({ enabled: useReadsEnabled() });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function renderBody() {
    if (targets.isError) {
      return (
        <ErrorState
          retry={{
            label: RETRY_LABEL,
            onPress: () => {
              void targets.refetch();
            },
          }}
          title={GENERIC_ERROR}
        />
      );
    }
    if (targets.data === undefined) {
      return (
        <View className="px-4 pt-2">
          <Skeleton variant="group" rows={2} />
        </View>
      );
    }

    return <TargetsForm initial={targets.data} />;
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the About screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: TARGETS_SCREEN.back, onPress: goBack }}
        title={TARGETS_SCREEN.title}
      />
      {renderBody()}
    </View>
  );
}
