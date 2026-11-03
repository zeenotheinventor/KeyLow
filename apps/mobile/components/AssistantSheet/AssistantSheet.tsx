import {
  useAssistantConversation,
  useAssistantStatus,
  useAssistantTurn,
  useNewAssistantConversation,
  useProfileTimeZone,
  useSetAssistantConsent,
} from "@keylow/api-client";
import {
  buildAssistantSheetThread,
  canAnswerAssistantQuestion,
  canSendAssistantMessage,
  describeAssistantComposer,
  isAssistantStatusKnown,
  isSentTurnStored,
  isStaleStreamGateNotice,
  resolveAssistantSheetAccess,
  resolveAssistantTimeZone,
} from "@keylow/core";
import { ASSISTANT_OFFLINE, ASSISTANT_SHEET, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { fetch as streamingFetch } from "expo/fetch";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { AssistantEmpty } from "./AssistantEmpty";
import { AssistantThread } from "./AssistantThread";
import { Composer } from "./Composer";
import { ConsentCard } from "./ConsentCard";
import { assistantCardHref } from "../../lib/assistantCardRoutes";
import { useIsOnline } from "../../lib/connectivity";
import { Badge, Banner, BottomSheet, SheetHeader, SheetScrollView, Text, useToast } from "../ui";

import type { AssistantSheetProps } from "./types";
import type { AssistantCardLink, AssistantSheetSent } from "@keylow/core";
import type { ComponentRef } from "react";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The boards' open height leaves the diary's header showing, 106 of 844 points from the top. The sheet drags
// up to full height, which starts 54 points from the top.
const SNAP_POINTS = ["87%", "94%"];
// The consent card opens at full height (`assistant · consent-needed`, 54 points from the top), and so does
// the sheet opened from Describe (`assistant · describe`) and a thread holding a recipe import card
// (`assistant · recipe-import`, `recipe-unresolved`), so its ingredient list shows.
const OPEN_SNAP_INDEX = 0;
const FULL_HEIGHT_SNAP_INDEX = 1;

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
export function AssistantSheet({ open, onClose, localDate, describeAt }: AssistantSheetProps) {
  const isOnline = useIsOnline();
  const router = useRouter();
  const conversation = useAssistantConversation({ enabled: open });
  const status = useAssistantStatus();
  const setConsent = useSetAssistantConsent();
  const profileTimeZone = useProfileTimeZone();
  const toast = useToast();
  const newConversation = useNewAssistantConversation();
  const { send, stop, live, isStreaming } = useAssistantTurn({ fetch: streamingFetch });
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<AssistantSheetSent | null>(null);
  const scrollRef = useRef<ComponentRef<typeof SheetScrollView>>(null);

  const items = conversation.data?.items;
  const timeZone = resolveAssistantTimeZone(profileTimeZone.data, deviceTimeZone());
  // A status that cannot be asked for offline is no reason to hold the sheet back, and the turn route stays
  // the authority for what it says.
  const access = resolveAssistantSheetAccess({
    statusNotice: status.data?.notice ?? null,
    isStatusKnown: isAssistantStatusKnown({
      isSuccess: status.isSuccess,
      isError: status.isError,
      failureCount: status.failureCount,
      isOnline,
    }),
    streamNotice: sent === null ? null : (live?.notice ?? null),
  });
  const thread = buildAssistantSheetThread({
    items: items ?? [],
    sent,
    live,
    isStreaming,
    accessNotice: access.kind === "limited" ? access.notice : null,
  });
  const composer = describeAssistantComposer({
    access,
    isOnline,
    timeZone,
    describeAt,
    fieldHint: thread.fieldHint,
  });

  // The turn on screen and what it left, for the read on open below, which finishes after the render that
  // started it.
  const turnOnScreen = useRef({ live, isStreaming });
  useEffect(() => {
    turnOnScreen.current = { live, isStreaming };
  });

  // Each time the sheet opens the status is read again, so a limit that has lifted, or consent given
  // elsewhere, shows at once. A read already under way is let finish. The gate notices store no turn, so
  // the stored conversation never moves past one and nothing else would let it go: once the read has
  // succeeded, the message sent from the sheet is let go with the notice its turn left, and the fresh
  // status decides.
  const { refetch: refetchStatus } = status;
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let isCurrent = true;
    void refetchStatus({ cancelRefetch: false }).then((result) => {
      const { live: latestLive, isStreaming: isStillStreaming } = turnOnScreen.current;
      if (
        isCurrent &&
        result.isSuccess &&
        isStaleStreamGateNotice({
          streamNotice: latestLive?.notice ?? null,
          isStreaming: isStillStreaming,
        })
      ) {
        setSent(null);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [open, refetchStatus]);

  // The thread is read once, so the empty sheet and its starters are not drawn for a moment over a
  // conversation that is still loading.
  const isThreadKnown = conversation.isSuccess || conversation.isError;
  const isEmpty = thread.entries.length === 0;

  // Once the answer has ended and the stored conversation holds the turn (a reply or a notice after
  // where the message was sent), the message sent from here is let go. If it were kept, the thread going
  // empty again (a new conversation, or every conversation deleted) would draw the old message back. A read
  // that holds only your message, or your message and a card while words are to come, does not count, or the
  // reply would vanish until the next read.
  if (sent !== null && !isStreaming && isSentTurnStored(items ?? [], sent.afterItemId, live)) {
    setSent(null);
  }

  const sendState = {
    isStreaming,
    isOnline,
    isThreadKnown,
    isThreadFetching: conversation.isFetching,
    // The turn's status clears with its next event, so the reading is over as soon as anything else arrives.
    isReadingRecipe: (live?.status ?? null) !== null,
    access,
  };
  const canSendWords = (words: string) => canSendAssistantMessage({ text: words, ...sendState });

  // The streaming message is not a live region (Android would read all of it again for each chunk, and iOS
  // ignores a live region), so a screen reader hears the finished answer once, on both, when it is complete.
  // An answer that was stopped by closing the sheet is not read, because the person closed it.
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) {
      const answer = live === null || live.stopped ? "" : live.text.trim();
      if (answer !== "") {
        AccessibilityInfo.announceForAccessibility(answer);
      }
    }
    wasStreaming.current = isStreaming;
  }, [isStreaming, live]);

  function sendMessage(words: string) {
    const text = words.trim();
    if (!canSendWords(text)) {
      return;
    }
    setSent({ text, afterItemId: items?.at(-1)?.id ?? null });
    // A settled read is the truth, so after Delete all conversations it is null and the dead id the live turn
    // still holds is not reused. The one the first turn started stands in only while the read is unknown or failed.
    const conversationId =
      conversation.isSuccess && !conversation.isFetching
        ? conversation.data.conversationId
        : (conversation.data?.conversationId ?? live?.conversationId ?? null);
    void send(text, { conversationId, localDate, localTime: describeAt });
  }

  function sendDraft() {
    if (canSendWords(draft)) {
      sendMessage(draft);
      setDraft("");
    }
  }

  function sendLastMessageAgain() {
    if (thread.lastMessage !== null) {
      sendMessage(thread.lastMessage);
    }
  }

  async function startNewConversation() {
    try {
      await newConversation.mutateAsync();
    } catch {
      // Nothing was cleared, and the thread stays as it was.
      return;
    }
    setSent(null);
    setDraft("");
  }

  function close() {
    if (isStreaming) {
      stop();
    }
    onClose();
  }

  // The sheet closes first, so the screen the link opens is not under it.
  function openCardLink(target: AssistantCardLink["target"]) {
    close();
    router.push(assistantCardHref(target));
  }

  function turnOnAssistant() {
    // The notice the stream left is of the time before consent, so it is let go with the message.
    setConsent.mutate(
      { on: true },
      {
        onSuccess: () => {
          setSent(null);
        },
        // The card stays and Turn on works again.
        onError: () => {
          toast.show({ message: SAVE_FAILED_BANNER, tone: "danger", icon: "CircleAlert" });
        },
      },
    );
  }

  const isNewDisabled =
    isEmpty || isStreaming || !isOnline || newConversation.isPending || access.kind === "consent";

  function renderBody() {
    if (access.kind === "checking") {
      return null;
    }
    if (access.kind === "consent") {
      return (
        <ConsentCard
          isOnline={isOnline}
          isTurningOn={setConsent.isPending}
          onNotNow={close}
          onTurnOn={turnOnAssistant}
        />
      );
    }
    if (isEmpty) {
      return isThreadKnown ? (
        <AssistantEmpty
          describeAt={describeAt}
          isDisabled={!isOnline || conversation.isFetching}
          onStarterPress={sendMessage}
        />
      ) : null;
    }
    return (
      <AssistantThread
        thread={thread}
        timeZone={timeZone}
        onAskAgain={sendLastMessageAgain}
        onTryAgain={sendLastMessageAgain}
        onOpenCardLink={openCardLink}
        canAnswer={canAnswerAssistantQuestion(sendState)}
        onAnswer={sendMessage}
      />
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
              disabled: isNewDisabled,
              onPress: () => {
                void startNewConversation();
              },
            }}
            title={ASSISTANT_SHEET.title}
            trailing={{ icon: "X", label: ASSISTANT_SHEET.closeLabel, onPress: close }}
          />
        </View>
        <SheetScrollView
          className="flex-1"
          contentContainerClassName={
            threadClassNames[isEmpty || access.kind === "consent" ? "empty" : "conversation"]
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
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
              isSendDisabled={!canSendWords(draft)}
              placeholder={composer.placeholder}
              value={draft}
              onChangeText={setDraft}
              onSend={sendDraft}
            />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}
