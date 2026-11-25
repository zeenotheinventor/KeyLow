import {
  COMPANY_DETAILS,
  DELETE_ACCOUNT_COPY,
  describeDeleteAccountEmailAction,
} from "@keylow/core/copy";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { vars } from "nativewind";
import { useCallback } from "react";
import { BackHandler, Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  GroupedList,
  ListRow,
  SheetHeader,
  Text,
} from "../ui";
import { useDeleteAccountFlow } from "./useDeleteAccountFlow";

const copy = DELETE_ACCOUNT_COPY;

// The mail app is the phone's own, and a phone with none says nothing worth showing, so a failed open is dropped.
// `canOpenURL` is not asked first, because that needs a native query entry.
function openEmail() {
  Linking.openURL(`mailto:${COMPANY_DETAILS.contactEmail}`).catch(() => undefined);
}

/**
 * The Delete account screen, pushed from More (`delete-account · explain`, `explain-offline`, `confirm`, `deleting`,
 * `failed` and `unconfirmed`). The card, the warning and the Export my data row stay in every state. Above them
 * sit the notices of the last attempt, and below them the two buttons that stay fixed while the rest scrolls. The
 * confirm is the kit's destructive dialog, locked while the deletion runs. A confirmed deletion signs out and
 * AuthGate opens Sign in, so this screen never navigates after one.
 */
export function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flow = useDeleteAccountFlow();
  const { view, isOnline, isConfirmOpen, isDeleting } = flow;

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  // The Android back button does nothing while a deletion runs, only while this is the focused screen. A swipe
  // from the edge goes back on iOS, so it is off then too.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => isDeleting);

      return () => {
        subscription.remove();
      };
    }, [isDeleting]),
  );

  // The offline banner sits under the error banner. On the unconfirmed board its own banner already says to check
  // the connection, so none is added.
  const isOfflineBannerShown = !isOnline && view !== "unconfirmed";

  function renderNotices() {
    return (
      <>
        {view === "failed" ? (
          <Banner
            action={{ label: describeDeleteAccountEmailAction(), onPress: openEmail }}
            body={copy.failed.body}
            title={copy.failed.title}
            variant="error"
          />
        ) : null}
        {view === "unconfirmed" ? (
          <Banner
            announce
            body={copy.unconfirmed.body}
            title={copy.unconfirmed.title}
            variant="review"
          />
        ) : null}
        {isOfflineBannerShown ? (
          <Banner body={copy.offline.body} title={copy.offline.title} variant="offline" />
        ) : null}
      </>
    );
  }

  function renderFooter() {
    switch (view) {
      case "explain":
        return (
          <>
            <Button disabled={!isOnline} fullWidth variant="destructive" onPress={flow.openConfirm}>
              {copy.buttons.delete}
            </Button>
            <Button fullWidth variant="secondary" onPress={goBack}>
              {copy.buttons.keep}
            </Button>
          </>
        );
      case "failed":
        return (
          <>
            <Button disabled={!isOnline} fullWidth variant="destructive" onPress={flow.openConfirm}>
              {copy.buttons.retry}
            </Button>
            <Button fullWidth variant="secondary" onPress={goBack}>
              {copy.buttons.keep}
            </Button>
          </>
        );
      case "unconfirmed":
        return (
          <>
            <Button
              {...(isDeleting ? { accessibilityLabel: copy.dialog.deleting.spinnerLabel } : {})}
              disabled={!isOnline && !isDeleting}
              fullWidth
              loading={isDeleting}
              variant="destructive"
              onPress={flow.retryDeletion}
            >
              {copy.buttons.retry}
            </Button>
            <Button disabled={isDeleting} fullWidth variant="secondary" onPress={goBack}>
              {copy.buttons.backToMore}
            </Button>
          </>
        );
    }
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the Export my data screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <Stack.Screen options={{ gestureEnabled: !isDeleting }} />
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: copy.back, disabled: isDeleting, onPress: goBack }}
        title={copy.title}
        variant="stack"
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
        {renderNotices()}
        <Card aria-label={copy.card.title}>
          <View className="gap-2">
            <Text role="heading" variant="body-strong">
              {copy.card.title}
            </Text>
            <View className="gap-0" role="list">
              {copy.card.items.map((item) => (
                <View key={item} className="flex-row items-center gap-2" role="listitem">
                  <View aria-hidden className="h-1 w-1 rounded-pill bg-text-muted" />
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
            <Text tone="muted" variant="caption">
              {copy.card.caption}
            </Text>
          </View>
        </Card>
        <Banner icon="TriangleAlert" sentence title={copy.permanence} variant="review" />
        <GroupedList hidesTitle title={copy.exportRow.title}>
          <ListRow
            icon="Download"
            subtitle={copy.exportRow.subtitle}
            title={copy.exportRow.title}
            onPress={() => {
              router.push("/more/export");
            }}
          />
        </GroupedList>
      </ScrollView>
      <View className="gap-2 px-4 pb-3 pt-3">{renderFooter()}</View>
      <ConfirmDialog
        busy={isDeleting}
        body={isDeleting ? copy.dialog.deleting.body : copy.dialog.body}
        cancelLabel={copy.dialog.cancelLabel}
        confirmBusyLabel={copy.dialog.deleting.spinnerLabel}
        confirmLabel={copy.dialog.confirmLabel}
        lockWhileBusy
        open={isConfirmOpen}
        title={isDeleting ? copy.dialog.deleting.title : copy.dialog.title}
        tone="destructive"
        onCancel={flow.closeConfirm}
        onConfirm={flow.confirmDeletion}
      />
    </View>
  );
}
