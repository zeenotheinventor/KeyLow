import { ABOUT_SCREEN, LEGAL_URLS } from "@keylow/core/copy";
import { APP_VERSION, formatAppVersion, formatBuildLine } from "@keylow/core/format";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { vars } from "nativewind";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GroupedList, ListRow, SheetHeader, Text } from "../ui";
import { DataSourceCredit } from "./DataSourceCredit";

// The environment is typed loosely here, so this narrows a read to what it is.
const textOrUndefined = (value: unknown) => (typeof value === "string" ? value : undefined);

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The About screen, pushed from More: a stack header with Back, and the Data sources section, which
 * credits the datasets the app shows foods from, as their licences ask, and the Legal list, which opens the
 * Privacy Policy and the Terms in the browser. The About board draws both.
 */
export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { dataSources, legal } = ABOUT_SCREEN;

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function openInBrowser(url: string) {
    // A device with no browser rejects, and there is nothing else to do about it, so the screen stays as it is.
    Linking.openURL(url).catch(() => undefined);
  }

  // Metro inlines this value where `eas update` exports the bundle, and only for a read by this full name, so it
  // is never destructured or looked up by a key. The commit must stay out of the Expo config and `eas.json`: the
  // fingerprint hashes both, and a value that changes per commit there would change the runtime version on every merge.
  const commit = textOrUndefined(process.env.EXPO_PUBLIC_COMMIT_SHA);
  const buildLine = formatBuildLine({
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt,
    timeZone: deviceTimeZone(),
  });

  return (
    // The insets are runtime values no class can name, so they go through variables, as the food screens' do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: ABOUT_SCREEN.back, onPress: goBack }}
        title={ABOUT_SCREEN.title}
        variant="stack"
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 pb-4 pt-1">
        {/* A section title is 32 points high at least, as the grouped lists draw it. */}
        <View className="min-h-[32px] justify-center px-1">
          <Text role="heading" variant="body-strong">
            {dataSources.title}
          </Text>
        </View>
        <DataSourceCredit
          name={dataSources.cofid.name}
          text={dataSources.cofid.text}
          url={dataSources.cofid.url}
        />
        <DataSourceCredit
          name={dataSources.off.name}
          text={dataSources.off.text}
          url={dataSources.off.url}
        />
        {/* The board puts 14 points between groups. 12 and 16 are equally near, so this is 16, as on the web page: the 8 of the gap plus 8. */}
        <View className="mt-2">
          <GroupedList title={legal.title}>
            <ListRow
              icon="Shield"
              title={legal.privacy}
              onPress={() => {
                openInBrowser(LEGAL_URLS.privacy);
              }}
            />
            <ListRow
              icon="FileText"
              title={legal.terms}
              onPress={() => {
                openInBrowser(LEGAL_URLS.terms);
              }}
            />
          </GroupedList>
        </View>
        <View className="px-1">
          <Text variant="caption" tone="muted">
            {formatAppVersion({ version: APP_VERSION, commit })}
          </Text>
          {buildLine === null ? null : (
            <Text variant="caption" tone="muted">
              {buildLine}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
