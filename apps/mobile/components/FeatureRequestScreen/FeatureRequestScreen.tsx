import { isDailyLimitFailure, useCreateFeatureRequest } from "@keylow/api-client";
import { FEATURE_REQUEST_SCREEN, describeFeatureRequestLength } from "@keylow/core/copy";
import { featureRequestTextSchema, isFeatureRequestTooLong } from "@keylow/core/featureRequests";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dockBottomPadding } from "../../lib/dockBottomPadding";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { Banner, Button, Card, SheetHeader, Text, TextArea, useToast } from "../ui";

/**
 * The Request a feature screen, pushed from More. No board draws it, so it follows Export my data: a header
 * with Back, one line on where the request goes, a text area with its count, and Send in the footer. Send is
 * off until the trimmed text is long enough to save, and while a send is on its way. A send that works says
 * thanks, clears the field and goes back to More. One that fails keeps the text and shows a banner, with the
 * daily limit worded on its own. The text is only ever sent to the database: it is never logged or reported.
 */
export function FeatureRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  // The thanks is said from the hook, so it still shows when Back was pressed while the request was on its way.
  const sendRequest = useCreateFeatureRequest({
    onSaved: () => {
      toast.show({ message: FEATURE_REQUEST_SCREEN.sentToast, tone: "success", icon: "Check" });
    },
  });
  const [text, setText] = useState("");
  const frameRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);
  const copy = FEATURE_REQUEST_SCREEN;
  const isTooLong = isFeatureRequestTooLong(text);
  const canSend = featureRequestTextSchema.safeParse(text).success;

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function send() {
    if (!canSend || sendRequest.isPending) {
      return;
    }
    Keyboard.dismiss();
    sendRequest.mutate(
      { source: "more_menu", request: text },
      {
        onSuccess: () => {
          setText("");
          goBack();
        },
      },
    );
  }

  function renderProblem() {
    if (!sendRequest.isError) {
      return null;
    }
    const problem = isDailyLimitFailure(sendRequest.error) ? copy.dailyLimit : copy.failed;
    return <Banner body={problem.body} title={problem.title} variant="error" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      {/* The insets and the keyboard's cover are runtime values no class can name, so they go through variables. */}
      <View
        ref={frameRef}
        className="flex-1 pb-[var(--keyboard-lift)] pt-[var(--inset-top)]"
        style={vars({ "--inset-top": insets.top, "--keyboard-lift": keyboardLift })}
      >
        <SheetHeader
          leading={{ icon: "ChevronLeft", label: copy.back, onPress: goBack }}
          title={copy.title}
          variant="stack"
        />
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-4 pt-1"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={trackScrollOffset}
        >
          <Card>
            <Text tone="secondary">{copy.explainer}</Text>
          </Card>
          <TextArea
            counter={describeFeatureRequestLength(text)}
            error={isTooLong ? copy.tooLong : undefined}
            isOverLimit={isTooLong}
            label={copy.fieldLabel}
            placeholder={copy.placeholder}
            value={text}
            onChangeText={setText}
          />
          {renderProblem()}
        </ScrollView>
        <View
          className="border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
          style={vars({ "--dock-bottom": dockBottomPadding(insets.bottom) })}
        >
          <Button
            fullWidth
            disabled={!canSend}
            loading={sendRequest.isPending}
            size="lg"
            onPress={send}
          >
            {copy.send}
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
