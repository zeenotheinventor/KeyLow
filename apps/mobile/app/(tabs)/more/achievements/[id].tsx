import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

import { BadgeDetailSheet, useBadgeDetail } from "../../../../components/AchievementsScreen";
import { achievementsPath } from "../../../../lib/achievementRoutes";
import { useReadsEnabled } from "../../../../lib/useReadsEnabled";

// The detail of one badge, pushed over the Achievements screen and drawn above it: the screen is a transparent
// modal that fades in, so the sheet's own dim covers the screen, which stays on show behind it, as the trend
// explainer's route does. The unlock toast and the notification open this path too. Its presentation is set here
// and not in the stack's layout, which holds none of the screens' options.
export default function BadgeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const read = useBadgeDetail(id, useReadsEnabled());

  function close() {
    // A link can open the sheet cold, with nothing behind it, and going back would then throw, so it replaces
    // itself with the Achievements screen, as the other screens a link can open do.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(achievementsPath());
    }
  }

  // An id the catalogue does not know, or a read that failed, leaves nothing to show, so the screen behind it is shown.
  const isUnavailable = read.status === "unavailable";
  useEffect(() => {
    if (isUnavailable) {
      router.replace(achievementsPath());
    }
  }, [isUnavailable, router]);

  return (
    <>
      <Stack.Screen
        options={{
          presentation: "transparentModal",
          animation: "fade",
          // The stack paints every screen on the background colour. A transparent modal sets none of its own,
          // so clearing the stack's lets the Achievements screen show through the sheet's dim.
          contentStyle: undefined,
        }}
      />
      {read.status === "ready" ? (
        <BadgeDetailSheet detail={read.detail} open onClose={close} />
      ) : null}
    </>
  );
}
