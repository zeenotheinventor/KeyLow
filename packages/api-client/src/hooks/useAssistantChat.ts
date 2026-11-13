import {
  buildAssistantSheetThread,
  canAnswerAssistantQuestion,
  canSendAssistantMessage,
  chooseAssistantConversationId,
  describeAssistantComposer,
  finishedAnswerWords,
  isAssistantSheetOpening,
  isAssistantStatusKnown,
  isNewConversationDisabled,
  isSentTurnStored,
  isStaleStreamGateNotice,
  resolveAssistantSheetAccess,
  resolveAssistantTimeZone,
} from "@keylow/core";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DETACHED_TURN_POLL_MS,
  OPEN_TURN_DEADLINE_MS,
  detachedTurnState,
  openTurnDeadlineMs,
  runningOpenTurn,
  storedReplyText,
} from "../detachedTurn";
import { useAssistantConversation } from "./useAssistantConversation";
import { useAssistantStatus } from "./useAssistantStatus";
import { useAssistantTurn } from "./useAssistantTurn";
import { useNewAssistantConversation } from "./useNewAssistantConversation";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSetAssistantConsent } from "./useSetAssistantConsent";

import type { SkippedKind, StreamingFetch } from "../runAssistantTurn";
import type { AssistantOpenedFrom, AssistantSheetSent } from "@keylow/core";

// How long after a deadline the timer that renders again waits, so the clock it reads is past the deadline.
const DEADLINE_TIMER_MARGIN_MS = 50;

export type UseAssistantChatInput = {
  /** Whether the chat is on screen. The conversation is read while it is, and the status each time it opens. */
  open: boolean;
  /** The day the chat was opened on, in the person's time zone, `YYYY-MM-DD`. */
  localDate: string;
  /** The time Describe logs at, `HH:MM`. */
  describeAt?: string | undefined;
  /** The Train header, which asks about training in the field. */
  from?: AssistantOpenedFrom | undefined;
  /** The streaming `fetch` of the platform: the phone passes `expo/fetch`. */
  fetch: StreamingFetch;
  isOnline: boolean;
  /** The device's IANA time zone, used until the profile's is read. */
  deviceTimeZone: string;
  /** Called once with the finished answer's words when a turn that was streaming ends and was not stopped. */
  onAnswerFinished?: ((words: string) => void) | undefined;
  /** Called when turning the assistant on is refused, so the screen can say so. */
  onTurnOnFailed?: (() => void) | undefined;
  /** Called when a message is sent, so the screen can follow the end of the thread. */
  onMessageSent?: (() => void) | undefined;
  /** Called with the name of an event type or card kind this app does not know, which the turn skipped. */
  onKindSkipped?: ((skipped: SkippedKind) => void) | undefined;
  /** Called when a new conversation has started, so the screen can follow the end of the thread. */
  onNewConversationStarted?: (() => void) | undefined;
  /**
   * Off by default, so the web is unchanged. On, a turn whose stream breaks (the app went to the background,
   * the connection dropped, the sheet closed) is not failed: it shows as still working while the stored
   * conversation is read every 2 s, until the server has given the turn a final status, and then the stored
   * reply draws. Send stays off while the newest stored turn is open. A turn still open 150 s after its row
   * was created, or one that never reached the server, shows the failed turn notice.
   */
  resumeDetachedTurns?: boolean | undefined;
};

/**
 * The assistant chat's controller, shared by the phone's sheet and the web's panel: the draft, the message
 * sent from here and when it is let go, the conversation read, the status read again each time the chat
 * opens, consent, and the streaming turn. Pure work of what to draw and what the person may do is core's
 * (`buildAssistantSheetThread`, `resolveAssistantSheetAccess`, `describeAssistantComposer`). What stays
 * with the screen is drawing, scrolling, the router and the platform: they come in as inputs.
 */
export function useAssistantChat({
  open,
  localDate,
  describeAt,
  from,
  fetch,
  isOnline,
  deviceTimeZone,
  onAnswerFinished,
  onTurnOnFailed,
  onMessageSent,
  onNewConversationStarted,
  onKindSkipped,
  resumeDetachedTurns = false,
}: UseAssistantChatInput) {
  const conversation = useAssistantConversation({ enabled: open });
  const status = useAssistantStatus();
  const setConsent = useSetAssistantConsent();
  const profileTimeZone = useProfileTimeZone();
  const newConversation = useNewAssistantConversation();
  const { send, stop, live, isStreaming, settleDetached, refreshAfterStoredTurn } =
    useAssistantTurn({
      fetch,
      onKindSkipped,
      resumeDetachedTurns,
    });
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<AssistantSheetSent | null>(null);

  const items = conversation.data?.items;
  const { refetch: refetchConversation } = conversation;
  // The time the deadlines are judged against: set when the chat mounts and by the timer that renders again at
  // the moment a deadline passes, so a render never reads the clock.
  const [nowMs, setNowMs] = useState(Date.now);
  // The newest stored turn while the server is writing it. A turn that is open past its deadline is lost,
  // which is no reason to hold Send back or read on for ever.
  const storedOpenTurn = conversation.data?.openTurn ?? null;
  const openTurn = resumeDetachedTurns ? runningOpenTurn(storedOpenTurn, nowMs) : null;
  const detachedAtMs = live?.detached?.atMs;
  const isDetached = detachedAtMs !== undefined;
  // The turn is drawn as streaming while it is detached, so its working line shows under your message.
  const isTurnShown = isStreaming || isDetached;
  // When the conversation was last read by the reads below, which is what shows that a turn that left no
  // `turn` event never reached the server, once a read well after the detach still holds none of it.
  const [lastReadAtMs, setLastReadAtMs] = useState<number | null>(null);
  const readConversation = useCallback(
    (options?: { cancelRefetch: boolean }) =>
      refetchConversation(options).then((result) => {
        if (result.isSuccess) {
          // Each read also moves the clock the deadlines are judged against, as a second way to notice one passing.
          const readAtMs = Date.now();
          setLastReadAtMs(readAtMs);
          setNowMs(readAtMs);
        }
        return result;
      }),
    [refetchConversation],
  );
  const timeZone = resolveAssistantTimeZone(profileTimeZone.data, deviceTimeZone);
  // A status that cannot be asked for offline is no reason to hold the chat back, and the turn route stays
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
  const detachedState =
    !isStreaming && live !== null && detachedAtMs !== undefined
      ? sent === null
        ? "stored"
        : detachedTurnState({
            live,
            detachedAtMs,
            afterItemId: sent.afterItemId,
            items: items ?? [],
            openTurn: storedOpenTurn,
            lastReadAtMs,
            nowMs,
          })
      : null;
  const thread = buildAssistantSheetThread({
    items: items ?? [],
    sent,
    live,
    isStreaming: isTurnShown,
    isStoredTurnOpen: openTurn !== null,
    accessNotice: access.kind === "limited" ? access.notice : null,
  });
  const composer = describeAssistantComposer({
    access,
    isOnline,
    timeZone,
    describeAt,
    from,
    fieldHint: thread.fieldHint,
  });

  // The turn on screen and what it left, for the read on open below, which finishes after the render that
  // started it.
  const turnOnScreen = useRef({ live, isStreaming });
  useEffect(() => {
    turnOnScreen.current = { live, isStreaming };
  });

  // Each time the chat opens the status is read again, so a limit that has lifted, or consent given
  // elsewhere, shows at once. A read already under way is let finish. The gate notices store no turn, so
  // the stored conversation never moves past one and nothing else would let it go: once the read has
  // succeeded, the message sent from the chat is let go with the notice its turn left, and the fresh
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

  // The thread is read once, so the empty state and its starters are not drawn for a moment over a
  // conversation that is still loading.
  const isThreadKnown = conversation.isSuccess || conversation.isError;
  const isEmpty = thread.entries.length === 0;

  // Once the answer has ended and the stored conversation holds the turn (a reply or a notice after
  // where the message was sent), the message sent from here is let go. If it were kept, the thread going
  // empty again (a new conversation, or every conversation deleted) would draw the old message back. A read
  // that holds only your message, or your message and a card while words are to come, does not count, or the
  // reply would vanish until the next read.
  // A detached turn is let go by the effect below, which also announces its reply.
  if (
    sent !== null &&
    !isStreaming &&
    !isDetached &&
    isSentTurnStored(items ?? [], sent.afterItemId, live)
  ) {
    setSent(null);
  }

  const sendState = {
    isStreaming: isTurnShown,
    isOnline,
    isThreadKnown,
    isThreadFetching: conversation.isFetching,
    // The turn's step clears with its next event, so it is over as soon as anything else arrives.
    isWorking: (live?.status ?? null) !== null || openTurn !== null,
    access,
  };
  const canSendWords = (words: string) => canSendAssistantMessage({ text: words, ...sendState });

  // A streaming message is not a live region (Android would read all of it again for each chunk, and iOS
  // ignores a live region), so a screen reader hears the finished answer once, when it is complete.
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) {
      const answer = finishedAnswerWords(live);
      if (answer !== "") {
        onAnswerFinished?.(answer);
      }
    }
    wasStreaming.current = isStreaming;
  }, [isStreaming, live, onAnswerFinished]);

  // A detached turn is read once as it detaches, and again each time the chat opens, so a turn that finished
  // while it was closed is found at once.
  useEffect(() => {
    if (open && isDetached && !isStreaming) {
      void readConversation();
    }
  }, [open, isDetached, isStreaming, live, readConversation]);

  // While the chat is open and a turn is open (or detached and not decided), the stored conversation is read
  // every 2 s. Nothing is read with the chat closed, or when no turn is open.
  const isAwaitingStoredTurn =
    open && !isStreaming && (openTurn !== null || detachedState === "waiting");
  useEffect(() => {
    if (!isAwaitingStoredTurn) {
      return undefined;
    }
    const timer = setInterval(() => {
      void readConversation({ cancelRefetch: false });
    }, DETACHED_TURN_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [isAwaitingStoredTurn, readConversation]);

  // Renders again when the earliest deadline passes, which is when the turn is taken as lost.
  const deadlines = [
    openTurn === null ? null : openTurnDeadlineMs(openTurn),
    detachedState === "waiting" && detachedAtMs !== undefined
      ? detachedAtMs + OPEN_TURN_DEADLINE_MS
      : null,
  ].filter((deadline) => deadline !== null);
  const nextDeadlineMs = deadlines.length === 0 ? null : Math.min(...deadlines);
  useEffect(() => {
    if (nextDeadlineMs === null) {
      return undefined;
    }
    const timer = setTimeout(
      () => {
        setNowMs(Date.now());
      },
      // A little after the deadline, so the clock read in the callback is past it and the turn is not left working.
      Math.max(0, nextDeadlineMs - Date.now()) + DEADLINE_TIMER_MARGIN_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [nextDeadlineMs]);

  // The stored conversation decides a detached turn: a stored ending lets the live turn go, so the stored one
  // draws and the message sent from here is let go with it, and a resumed reply is announced once, only while
  // the chat is open. A turn that is lost shows as failed.
  // A turn that was open when the chat found it, with no live turn of this chat (the app was restarted while
  // it ran), is watched until it ends: its writes are read again and its reply is announced, as for a detached one.
  const isWatchingRestartedTurn = useRef(false);
  useEffect(() => {
    if (openTurn !== null && sent === null && live === null) {
      isWatchingRestartedTurn.current = true;
    } else if (isWatchingRestartedTurn.current && openTurn === null) {
      isWatchingRestartedTurn.current = false;
      refreshAfterStoredTurn();
      const lastUser = items?.filter((item) => item.kind === "user").at(-1);
      const answer = finishedAnswerWords({
        text: lastUser === undefined ? "" : storedReplyText(items ?? [], lastUser.id),
        stopped: false,
        outcome: "complete",
      });
      if (open && answer !== "") {
        onAnswerFinished?.(answer);
      }
    }
  }, [openTurn, sent, live, items, open, onAnswerFinished, refreshAfterStoredTurn]);

  const resolution = useRef({ open, onAnswerFinished, reply: "" });
  useEffect(() => {
    resolution.current = {
      open,
      onAnswerFinished,
      reply: sent === null ? "" : storedReplyText(items ?? [], sent.afterItemId),
    };
  });
  useEffect(() => {
    if (detachedState === "stored") {
      const { open: isOpenNow, onAnswerFinished: announce, reply } = resolution.current;
      const answer = finishedAnswerWords({ text: reply, stopped: false, outcome: "complete" });
      if (isOpenNow && answer !== "") {
        announce?.(answer);
      }
      settleDetached("stored");
    } else if (detachedState === "failed") {
      settleDetached("failed");
    }
  }, [detachedState, settleDetached]);

  // For the app coming back to the foreground: the turn may have finished, or the limit lifted, while it was away.
  function refresh() {
    void refetchConversation({ cancelRefetch: false });
    void refetchStatus({ cancelRefetch: false });
  }

  function sendMessage(words: string) {
    const text = words.trim();
    if (!canSendWords(text)) {
      return;
    }
    onMessageSent?.();
    setSent({ text, afterItemId: items?.at(-1)?.id ?? null });
    const conversationId = chooseAssistantConversationId({
      readIsSettled: conversation.isSuccess && !conversation.isFetching,
      readConversationId: conversation.data?.conversationId,
      liveConversationId: live?.conversationId,
    });
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
    onNewConversationStarted?.();
    setSent(null);
    setDraft("");
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
          onTurnOnFailed?.();
        },
      },
    );
  }

  // The placeholder stands in until the status and the conversation are read, so the chat is never blank.
  // The composer shows under it with Send off, and New conversation is dimmed.
  const isOpening = isAssistantSheetOpening({ access, isEmpty, isThreadKnown });
  const isNewDisabled = isNewConversationDisabled({
    isEmpty,
    isOpening,
    isStreaming: isTurnShown,
    isOnline,
    isStartingNew: newConversation.isPending,
    isConsentNeeded: access.kind === "consent",
  });

  return {
    thread,
    composer,
    access,
    timeZone,
    draft,
    setDraft,
    canSendDraft: canSendWords(draft),
    sendDraft,
    sendMessage,
    sendLastMessageAgain,
    startNewConversation,
    turnOnAssistant,
    isTurningOn: setConsent.isPending,
    stop,
    refresh,
    isStreaming,
    isOpening,
    isEmpty,
    isThreadKnown,
    isNewDisabled,
    canAnswer: canAnswerAssistantQuestion(sendState),
    isStarterDisabled: !isOnline || conversation.isFetching,
    hasOlder: conversation.hasOlder,
    loadOlder: conversation.loadOlder,
    isLoadingOlder: conversation.isLoadingOlder,
  };
}
