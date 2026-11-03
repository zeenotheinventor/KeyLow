import {
  useAssistantConsent,
  useDeleteAllAssistantConversations,
  useSetAssistantConsent,
} from "@keylow/api-client";
import {
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_DELETE_ALL_DIALOG,
  ASSISTANT_SETTINGS,
  LEGAL_URLS,
  SAVE_FAILED_BANNER,
  describeAssistantConsentCaption,
} from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, ConfirmDialog, GroupedList, ListRow, SheetHeader, Text, useToast } from "../ui";

// The link is a line of text, so it reaches the 44 point touch target by hit slop.
const linkHitSlop = { top: 14, bottom: 14 };

const saveFailedToast = {
  message: SAVE_FAILED_BANNER,
  tone: "danger",
  icon: "CircleAlert",
} as const;

function openPrivacyPolicy() {
  // A device with no browser rejects, and there is nothing else to do about it, so the screen stays as it is.
  Linking.openURL(LEGAL_URLS.privacy).catch(() => undefined);
}

/**
 * The Assistant settings screen, pushed from More (`assistant-settings · consent`): the switch that turns the
 * assistant on, with its caption, what it does in the consent card's own words and the Privacy policy link,
 * and, once it is on, Delete all conversations behind a confirmation. The switch is off until the setting
 * has been read, and busy while a change is being saved. The sheet is told through the hook: turning the
 * assistant on or off reads its status again before the change is done. "What the assistant changed" is
 * the next ticket's row, with the screen it opens.
 */
export function AssistantSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const consent = useAssistantConsent();
  const setConsent = useSetAssistantConsent();
  const deleteAll = useDeleteAllAssistantConversations();
  const toast = useToast();
  const [isAskingToDelete, setIsAskingToDelete] = useState(false);
  const isRead = consent.data !== undefined;
  const isOn = consent.data?.isOn ?? false;

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function deleteEverything() {
    // The question closes either way, so a failure's toast is not under it, and the row asks again.
    deleteAll.mutate(undefined, {
      onSuccess: () => {
        setIsAskingToDelete(false);
      },
      onError: () => {
        setIsAskingToDelete(false);
        toast.show(saveFailedToast);
      },
    });
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: ASSISTANT_SETTINGS.back, onPress: goBack }}
        title={ASSISTANT_SETTINGS.title}
        variant="stack"
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6 pt-1">
        <View className="gap-2">
          <Card padding={0}>
            <ListRow
              title={ASSISTANT_SETTINGS.useLabel}
              toggle={{
                isOn,
                label: ASSISTANT_SETTINGS.useLabel,
                disabled: !isRead || setConsent.isPending,
                onValueChange: (next) => {
                  // A refused write changes nothing, so the switch stays as it was and the toast says so.
                  setConsent.mutate(
                    { on: next },
                    {
                      onError: () => {
                        toast.show(saveFailedToast);
                      },
                    },
                  );
                },
              }}
            />
          </Card>
          {isRead ? (
            <View className="px-1">
              <Text tone="muted" variant="caption">
                {describeAssistantConsentCaption(isOn)}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="gap-2">
          {/* A section title is 32 points high at least, as the grouped lists draw it. */}
          <View className="min-h-[32px] justify-center px-1">
            <Text role="heading" variant="body-strong">
              {ASSISTANT_SETTINGS.whatItDoes}
            </Text>
          </View>
          <Card>
            <View className="gap-3">
              {ASSISTANT_CONSENT_CARD.paragraphs.map((paragraph) => (
                <Text key={paragraph} tone="secondary">
                  {paragraph}
                </Text>
              ))}
              <Pressable
                hitSlop={linkHitSlop}
                role="link"
                className="self-start"
                onPress={openPrivacyPolicy}
              >
                <Text className="underline" tone="accent-ink" variant="body-strong">
                  {ASSISTANT_CONSENT_CARD.privacyLinkLabel}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
        {isOn ? (
          <View className="gap-2">
            <GroupedList title={ASSISTANT_SETTINGS.yourConversations}>
              <ListRow
                chevron={false}
                title={ASSISTANT_SETTINGS.deleteAllLabel}
                titleTone="danger"
                onPress={() => {
                  setIsAskingToDelete(true);
                }}
              />
            </GroupedList>
            <View className="px-1">
              <Text tone="muted" variant="caption">
                {ASSISTANT_SETTINGS.deleteAllCaption}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <ConfirmDialog
        body={ASSISTANT_DELETE_ALL_DIALOG.body}
        busy={deleteAll.isPending}
        cancelLabel={ASSISTANT_DELETE_ALL_DIALOG.cancelLabel}
        confirmLabel={ASSISTANT_DELETE_ALL_DIALOG.confirmLabel}
        open={isAskingToDelete}
        title={ASSISTANT_DELETE_ALL_DIALOG.title}
        tone="destructive"
        onCancel={() => {
          setIsAskingToDelete(false);
        }}
        onConfirm={deleteEverything}
      />
    </View>
  );
}
