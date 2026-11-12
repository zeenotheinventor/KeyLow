import {
  useAssistantChat,
  useAssistantConversation,
  useAssistantStatus,
  useAssistantTurn,
  useNewAssistantConversation,
  useProfileTimeZone,
  useSetAssistantConsent,
} from "@keylow/api-client";
import { ASSISTANT_OFFLINE, ASSISTANT_SHEET, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { fetch as streamingFetch } from "expo/fetch";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, View } from "react-native";

import { AssistantEmpty } from "./AssistantEmpty";
import { AssistantThread } from "./AssistantThread";
import { Composer } from "./Composer";
import { ConsentCard } from "./ConsentCard";
import { OpeningPlaceholder } from "./OpeningPlaceholder";
import { assistantCardHref } from "../../lib/assistantCardRoutes";
import { useIsOnline } from "../../lib/connectivity";
import { Badge, Banner, BottomSheet, SheetHeader, SheetScrollView, Text, useToast } from "../ui";

import type { AssistantSheetProps } from "./types";
import type { AssistantCardLink } from "@keylow/core";
import type { ComponentRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

// The hooks come from the package's index here, so a test that stands in for one of them there is heard.
const chatReaders = {
  useAssistantConversation,
  useAssistantStatus,
  useAssistantTurn,
  useNewAssistantConversation,
  useProfileTimeZone,
  useSetAssistantConsent,
};

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The boards' open height leaves the diary's header showing, 106 of 844 points from the top. The sheet drags
// up to full height, which starts 54 points from the top.
const SNAP_POINTS = ["87%", "94%"];
// The consent card opens at full height (`assistant · consent-needed`, 54 points from the top), and so does
// the sheet opened from Describe (`assistant · describe`) and a thread holding a recipe import card
// (`assistant · recipe-import`, `recipe-unresolved`), so its ingredient list shows.
const OPEN_SNAP_INDEX = 0;
const FULL_HEIGHT_SNAP_INDEX = 1;

// How far from the end of the thread, in points, the person can scroll and still be reading the end of it.
const NEAR_THE_END_DISTANCE = 40;
// How far from the top of the thread, in points, a scroll of the person's own starts loading older turns.
const NEAR_THE_TOP_DISTANCE = 300;
// Scroll events carry on after a finger is lifted, while the flick settles. The library's scroll view does not
// pass on the end of that, so the scroll counts as the person's until no event has arrived for this long.
const SCROLL_SETTLED_MS = 150;

const distanceFromEnd = ({ contentOffset, contentSize, layoutMeasurement }: NativeScrollEvent) =>
  contentSize.height - layoutMeasurement.height - contentOffset.y;

// The thread grows up from the composer once there is a conversation, and starts at the top when it is the
// empty state's words.
const threadClassNames = {
  conversation: "grow justify-end gap-3 px-0 pb-3 pt-2",
  empty: "grow justify-start gap-3 px-0 pb-3 pt-2",
} as const;

/**
 * The assistant's chat sheet over the diary (`assistant · empty`, `streaming`, `conversation`,
 * `unavailable`, and the access states `consent-needed`, `day-limit`, `plus` and `resting`). It reads the newest conversation, sends a typed message or a starter through the streaming
 * turn, and draws the reply as it grows. Closing the sheet during a stream stops it and keeps what arrived,
 * marked as stopped, with Ask again. The sheet owns the draft and the message sent from it, and the pure
 * work of what to draw is core's `buildAssistantSheetThread`, and of what the person may do (the consent
 * card, a disabled composer under a limit) is `resolveAssistantSheetAccess`. The status is read again each
 * time the sheet opens.
 */
export function AssistantSheet({
  open,
  onClose,
  localDate,
  describeAt,
  from,
}: AssistantSheetProps) {
  const isOnline = useIsOnline();
  const router = useRouter();
  const toast = useToast();
  // Whether a growing thread is followed to its end. It is on until the person's own drag takes them away from
  // the end, and on again when they come back, send a message, start a new conversation or open the sheet.
  // Opening a day of a routine grows the thread in the middle, and someone reading up the thread is left where
  // they are. Only the person's own scroll changes it, never a scroll event the sheet's own scrollToEnd causes,
  // which can report an offset behind the end while the content grows under it.
  const isFollowingEnd = useRef(true);
  const chat = useAssistantChat({
    readers: chatReaders,
    open,
    localDate,
    describeAt,
    from,
    fetch: streamingFetch,
    isOnline,
    deviceTimeZone: deviceTimeZone(),
    // The streaming message is not a live region (Android would read all of it again for each chunk, and iOS
    // ignores a live region), so a screen reader hears the finished answer once, on both, when it is complete.
    onAnswerFinished: (words) => {
      AccessibilityInfo.announceForAccessibility(words);
    },
    onTurnOnFailed: () => {
      toast.show({ message: SAVE_FAILED_BANNER, tone: "danger", icon: "CircleAlert" });
    },
    onMessageSent: () => {
      isFollowingEnd.current = true;
    },
    onNewConversationStarted: () => {
      isFollowingEnd.current = true;
    },
  });
  const { access, thread, composer, isOpening, isEmpty } = chat;
  const scrollRef = useRef<ComponentRef<typeof SheetScrollView>>(null);
  const isUserScrolling = useRef(false);
  const scrollSettledTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (open) {
      isFollowingEnd.current = true;
    }
  }, [open]);
  useEffect(
    () => () => {
      clearTimeout(scrollSettledTimer.current);
    },
    [],
  );

  function readUserScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    isFollowingEnd.current = distanceFromEnd(event.nativeEvent) <= NEAR_THE_END_DISTANCE;
    // Reading up towards older turns is never followed back to the end, even in a thread short enough for
    // the top and the end to be within reach of each other, and the turns that load must not pull the view.
    if (chat.hasOlder && event.nativeEvent.contentOffset.y <= NEAR_THE_TOP_DISTANCE) {
      isFollowingEnd.current = false;
      if (!chat.isLoadingOlder) {
        chat.loadOlder();
      }
    }
  }

  // Scroll events count as the person's from the touch down to a quiet moment after the finger lifts.
  function startUserScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    clearTimeout(scrollSettledTimer.current);
    isUserScrolling.current = true;
    readUserScroll(event);
  }

  function continueUserScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!isUserScrolling.current) {
      return;
    }
    readUserScroll(event);
    clearTimeout(scrollSettledTimer.current);
    scrollSettledTimer.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, SCROLL_SETTLED_MS);
  }

  function close() {
    if (chat.isStreaming) {
      chat.stop();
    }
    onClose();
  }

  // The sheet closes first, so the screen the link opens is not under it.
  function openCardLink(target: AssistantCardLink["target"]) {
    close();
    router.push(assistantCardHref(target));
  }

  function renderBody() {
    if (isOpening) {
      return <OpeningPlaceholder />;
    }
    if (access.kind === "consent") {
      return (
        <ConsentCard
          isOnline={isOnline}
          isTurningOn={chat.isTurningOn}
          onNotNow={close}
          onTurnOn={chat.turnOnAssistant}
        />
      );
    }
    if (isEmpty) {
      return (
        <AssistantEmpty
          describeAt={describeAt}
          from={from}
          isDisabled={chat.isStarterDisabled}
          onStarterPress={chat.sendMessage}
        />
      );
    }
    return (
      <>
        {chat.isLoadingOlder ? <OpeningPlaceholder key="older-turns-placeholder" /> : null}
        <AssistantThread
          thread={thread}
          timeZone={chat.timeZone}
          onAskAgain={chat.sendLastMessageAgain}
          onTryAgain={chat.sendLastMessageAgain}
          onOpenCardLink={openCardLink}
          canAnswer={chat.canAnswer}
          onAnswer={chat.sendMessage}
        />
      </>
    );
  }

  return (
    <BottomSheet
      label={ASSISTANT_SHEET.title}
      open={open}
      snapIndex={
        access.kind === "consent" || describeAt !== undefined || thread.needsFullHeight
          ? FULL_HEIGHT_SNAP_INDEX
          : OPEN_SNAP_INDEX
      }
      snapPoints={SNAP_POINTS}
      onClose={close}
    >
      <View className="flex-1">
        {/* The header brings its own side padding, so it goes out to the sheet's edges. */}
        <View className="-mx-4">
          <SheetHeader
            variant="quiet"
            leading={{
              icon: "SquarePen",
              label: ASSISTANT_SHEET.newConversationLabel,
              disabled: chat.isNewDisabled,
              onPress: () => {
                void chat.startNewConversation();
              },
            }}
            title={ASSISTANT_SHEET.title}
            trailing={{ icon: "X", label: ASSISTANT_SHEET.closeLabel, onPress: close }}
          />
        </View>
        <SheetScrollView
          className="flex-1"
          contentContainerClassName={
            threadClassNames[
              !isOpening && (isEmpty || access.kind === "consent") ? "empty" : "conversation"
            ]
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ref={scrollRef}
          onLayout={() => {
            // The scroll view gets its height after a cached thread has already settled its size, and again
            // when the sheet changes snap point, and each time the end has to be scrolled to once more.
            if (isFollowingEnd.current) {
              scrollRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onContentSizeChange={() => {
            if (isFollowingEnd.current) {
              scrollRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScroll={continueUserScroll}
          onScrollBeginDrag={startUserScroll}
          onScrollEndDrag={continueUserScroll}
        >
          {renderBody()}
        </SheetScrollView>
        {/* The hairline runs the sheet's whole width, so the composer goes out to its edges too. */}
        {composer.isShown ? (
          <View className="-mx-4 gap-2 border-t border-border px-4 pt-2">
            {isOnline ? null : (
              <Banner
                body={ASSISTANT_OFFLINE.body}
                title={ASSISTANT_OFFLINE.title}
                variant="offline"
              />
            )}
            {composer.hint === undefined ? null : (
              <View className="flex-row items-center gap-2">
                <Badge outlined>{composer.hint.chip}</Badge>
                <Text tone="muted" variant="caption">
                  {composer.hint.text}
                </Text>
              </View>
            )}
            <Composer
              isAutoFocused={describeAt !== undefined}
              isFieldDisabled={composer.isFieldDisabled}
              isSendDisabled={!chat.canSendDraft}
              placeholder={composer.placeholder}
              value={chat.draft}
              onChangeText={chat.setDraft}
              onSend={chat.sendDraft}
            />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}
