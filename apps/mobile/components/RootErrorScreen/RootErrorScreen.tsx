import { GENERIC_ERROR, RETRY_LABEL, ROOT_ERROR } from "@keylow/core/copy";
import { captureException } from "@sentry/react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { vars } from "nativewind";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme, ThemeProvider } from "../../lib/theme";
import { Button, ErrorState } from "../ui";

import type { RootErrorScreenProps } from "./types";

function RootErrorBody({ retry }: Pick<RootErrorScreenProps, "retry">) {
  const router = useRouter();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    // The insets are runtime values no class can name, so they go through variables, as the entry load state's does.
    <View
      className="flex-1 justify-center bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <ErrorState
        retry={{ label: RETRY_LABEL, onPress: () => void retry() }}
        size="section"
        title={GENERIC_ERROR}
      />
      <Button
        className="self-center"
        variant="ghost"
        onPress={() => {
          router.replace("/diary");
        }}
      >
        {ROOT_ERROR.diaryAction}
      </Button>
    </View>
  );
}

/**
 * What the app shows in place of everything when a route fails to render, exported from the root layout as
 * its `ErrorBoundary`: the fixed sentence "Something went wrong. Try again.", a Try again button that draws the
 * route again, and a button to the diary. The root layout is replaced when this shows, and its theme and safe
 * area with it, so the screen brings its own, with the theme read from storage as the layout reads it. The
 * error is logged with `console.error` for the device log and reported to Sentry, which sends its type and
 * stack but never its message (see `scrubEvent`). It is never shown, because it can quote health data.
 */
export function RootErrorScreen({ error, retry }: RootErrorScreenProps) {
  useEffect(() => {
    console.error(error);
    captureException(error);
  }, [error]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootErrorBody retry={retry} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
