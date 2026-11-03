import {
  useAssistantConversation,
  useAssistantTurn,
  useNewAssistantConversation,
} from "@keylow/api-client";
import { buildAssistantSheetThread, canSendAssistantMessage } from "@keylow/core";
import { ASSISTANT_OFFLINE, ASSISTANT_SHEET } from "@keylow/core/copy";
import { fetch as streamingFetch } from "expo/fetch";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, View } from "react-native";

import { AssistantEmpty } from "./AssistantEmpty";
import { AssistantThread } from "./AssistantThread";
import { Composer } from "./Composer";
import { useIsOnline } from "../../lib/connectivity";
import { Banner, BottomSheet, SheetHeader, SheetScrollView } from "../ui";

import type { AssistantSheetProps } from "./types";
import type { AssistantSheetSent } from "@keylow/core";
import type { ComponentRef } from "react";

// The boards' open height leaves the diary's header showing, 106 of 844 points from the top. The sheet drags
// up to full height, which starts 54 points from the top.
const SNAP_POINTS = ["87%", "94%"];

// The thread grows up from the composer once there is a conversation, and starts at the top when it is the
// empty state's words.
const threadClassNames = {
  conversation: "grow justify-end gap-3 px-0 pb-3 pt-2",
  empty: "grow justify-start gap-3 px-0 pb-3 pt-2",
} as const;

/**
 * The assistant's chat sheet over the diary (`assistant · empty`, `streaming`, `conversation` and
 * `unavailable`). It reads the newest conversation, sends a typed message or a starter through the streaming
 * turn, and draws the reply as it grows. Closing the sheet during a stream stops it and keeps what arrived,
 * marked as stopped, with Ask again. The sheet owns the draft and the message sent from it, and the pure
 * work of what to draw is core's `buildAssistantSheetThread`.
 */
export function AssistantSheet({ open, onClose, localDate }: AssistantSheetProps) {
  const isOnline = useIsOnline();
  const conversation = useAssistantConversation({ enabled: open });
  const newConversation = useNewAssistantConversation();
  const { send, stop, live, isStreaming } = useAssistantTurn({ fetch: streamingFetch });
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<AssistantSheetSent | null>(null);
  const scrollRef = useRef<ComponentRef<typeof SheetScrollView>>(null);

  const items = conversation.data?.items;
  const thread = buildAssistantSheetThread({ items: items ?? [], sent, live, isStreaming });
  // The thread is read once, so the empty sheet and its starters are not drawn for a moment over a
  // conversation that is still loading.
  const isThreadKnown = conversation.isSuccess || conversation.isError;
  const isEmpty = thread.entries.length === 0;

  // iOS ignores a live region, so a screen reader hears the finished answer once, when it is complete.
  // Android reads the live region itself.
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !isStreaming && Platform.OS === "ios") {
      const answer = live === null || live.stopped ? "" : live.text.trim();
      if (answer !== "") {
        AccessibilityInfo.announceForAccessibility(answer);
      }
    }
    wasStreaming.current = isStreaming;
  }, [isStreaming, live]);

  function sendMessage(words: string) {
    const text = words.trim();
    if (!canSendAssistantMessage({ text, isStreaming, isOnline })) {
      return;
    }
    setSent({ text, afterItemId: items?.at(-1)?.id ?? null });
    // The thread's own conversation, or the one the first turn started, which is not read yet.
    const conversationId = conversation.data?.conversationId ?? live?.conversationId ?? null;
    void send(text, { conversationId, localDate });
  }

  function sendDraft() {
    sendMessage(draft);
    setDraft("");
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

  const isNewDisabled = isEmpty || isStreaming || !isOnline || newConversation.isPending;

  return (
    <BottomSheet label={ASSISTANT_SHEET.title} open={open} snapPoints={SNAP_POINTS} onClose={close}>
      <View className="flex-1">
        {/* The header brings its own side padding, so it goes out to the sheet's edges. */}
        <View className="-mx-4">
          <SheetHeader
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
          contentContainerClassName={threadClassNames[isEmpty ? "empty" : "conversation"]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
        >
          {isEmpty ? (
            isThreadKnown ? (
              <AssistantEmpty isDisabled={!isOnline} onStarterPress={sendMessage} />
            ) : null
          ) : (
            <AssistantThread
              thread={thread}
              onAskAgain={sendLastMessageAgain}
              onTryAgain={sendLastMessageAgain}
            />
          )}
        </SheetScrollView>
        {/* The hairline runs the sheet's whole width, so the composer goes out to its edges too. */}
        <View className="-mx-4 gap-2 border-t border-border px-4 pt-2">
          {isOnline ? null : (
            <Banner
              body={ASSISTANT_OFFLINE.body}
              title={ASSISTANT_OFFLINE.title}
              variant="offline"
            />
          )}
          <Composer
            isFieldDisabled={!isOnline}
            isSendDisabled={!canSendAssistantMessage({ text: draft, isStreaming, isOnline })}
            placeholder={
              isOnline ? ASSISTANT_SHEET.composerPlaceholder : ASSISTANT_OFFLINE.fieldText
            }
            value={draft}
            onChangeText={setDraft}
            onSend={sendDraft}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
