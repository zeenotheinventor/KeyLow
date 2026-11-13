"use client";

import { useAssistantChat } from "@keylow/api-client";
import { ASSISTANT_OFFLINE, ASSISTANT_SHEET, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { CircleAlert, SquarePen, WifiOff, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AssistantComposer } from "../AssistantComposer";
import { AssistantConsentCard } from "../AssistantConsentCard";
import { AssistantEmpty } from "../AssistantEmpty";
import { AssistantOpening } from "../AssistantOpening";
import { AssistantThread, AssistantThreadContext } from "../AssistantThread";
import { useIsDockedPanel } from "../useIsDockedPanel";

import type { AssistantPanelProps } from "./types";
import type { StreamingFetch } from "@keylow/api-client";
import type { KeyboardEvent } from "react";

import { Banner } from "@/components/ui/Banner";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { useModalLayer } from "@/lib/modalLayer";
import { useIsOnline } from "@/lib/useIsOnline";
import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

// The browser's own `fetch` reads a body as it arrives. It is looked up on each call, so `send` keeps its
// identity and a test can stand in for the network.
const streamingFetch: StreamingFetch = (url, init) => fetch(url, init);

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// How far from the end of the thread, in px, the person can scroll and still be reading the end of it.
const NEAR_THE_END_DISTANCE = 40;

// The thread grows up from the composer once there is a conversation, and starts at the top when it is the
// empty state's words or the consent card.
const threadClassNames = {
  conversation: "mt-auto",
  empty: "",
} as const;

/**
 * The assistant's chat panel (`web-assistant · empty`, `streaming`, `conversation`, `consent-needed`). From
 * the large breakpoint it is docked on the right, 400 px wide under the top bar, and not modal, so the page
 * beside it keeps working. Below it, it is a sheet over the whole page and a modal dialog. It reads the
 * newest conversation, sends a typed message or a starter through the streaming turn, and draws the reply as
 * it grows. Closing the panel during a stream stops it and keeps what arrived, marked as stopped. Everything
 * the chat does is `useAssistantChat`'s, and the pure work of what to draw is core's.
 */
export function AssistantPanel({
  isOpen,
  onClose,
  localDate,
  from,
  buttonRef,
  topOffset,
}: AssistantPanelProps) {
  const isOnline = useIsOnline();
  const isDocked = useIsDockedPanel();
  const toast = useToast();
  const [announcement, setAnnouncement] = useState<{ id: number; words: string } | null>(null);
  // Whether a growing thread is followed to its end. It is on until the person's own scroll takes them away
  // from the end, and on again when they come back, send a message, start a new conversation or open the panel.
  const isFollowingEnd = useRef(true);
  const threadRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const chat = useAssistantChat({
    open: isOpen,
    localDate,
    from,
    fetch: streamingFetch,
    isOnline,
    deviceTimeZone: deviceTimeZone(),
    // The streaming message is not a live region (a screen reader would read all of it again for each
    // chunk), so the finished answer is announced once, when it is complete.
    onAnswerFinished: (words) => {
      setAnnouncement((previous) => ({ id: (previous?.id ?? 0) + 1, words }));
    },
    onTurnOnFailed: () => {
      toast.show({ message: SAVE_FAILED_BANNER, tone: "danger", icon: CircleAlert });
    },
    onMessageSent: () => {
      isFollowingEnd.current = true;
    },
    onNewConversationStarted: () => {
      isFollowingEnd.current = true;
    },
  });
  const { access, thread, composer, isOpening, isEmpty, stop, isStreaming } = chat;
  const isConsentNeeded = access.kind === "consent";
  const isFieldShown = composer.isShown;

  // Closing the panel by any way, the top bar's button too, stops a reply that is arriving and keeps what came.
  useEffect(() => {
    if (!isOpen && isStreaming) {
      stop();
    }
  }, [isOpen, isStreaming, stop]);

  useEffect(() => {
    if (isOpen) {
      isFollowingEnd.current = true;
    }
  }, [isOpen]);

  // Opening moves focus to the field, or to the panel while the consent card has none. Focus that is
  // somewhere else on the page is left alone, as is a field that is off.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const focused = document.activeElement;
    const isFocusFree =
      focused === null ||
      focused === document.body ||
      focused === buttonRef.current ||
      panelRef.current?.contains(focused) === true;
    if (isFocusFree) {
      (isFieldShown ? fieldRef.current : panelRef.current)?.focus();
    }
  }, [isOpen, isFieldShown, buttonRef]);

  // The thread follows its end as it grows, unless the person scrolled up.
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (thread !== null && isFollowingEnd.current) {
      thread.scrollTop = thread.scrollHeight;
    }
  });

  function readScroll() {
    const thread = threadRef.current;
    if (thread !== null) {
      isFollowingEnd.current =
        thread.scrollHeight - thread.clientHeight - thread.scrollTop <= NEAR_THE_END_DISTANCE;
    }
  }

  // Below the large breakpoint the sheet is modal: the page behind stops scrolling and Tab stays inside it.
  useModalLayer({ panelRef, isActive: isOpen && !isDocked });

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      onClose();
    }
  }

  const threadActions = {
    timeZone: chat.timeZone,
    canAnswer: chat.canAnswer,
    onAnswer: chat.sendMessage,
    onSendAgain: chat.sendLastMessageAgain,
  };

  function renderBody() {
    if (isOpening) {
      return <AssistantOpening />;
    }
    if (isConsentNeeded) {
      return (
        <AssistantConsentCard
          isOnline={isOnline}
          isTurningOn={chat.isTurningOn}
          onNotNow={onClose}
          onTurnOn={chat.turnOnAssistant}
        />
      );
    }
    if (isEmpty) {
      return (
        <AssistantEmpty
          from={from}
          isDisabled={chat.isStarterDisabled}
          onStarterPress={chat.sendMessage}
        />
      );
    }
    return <AssistantThread thread={thread} />;
  }

  return (
    <div
      ref={panelRef}
      role={isDocked ? "complementary" : "dialog"}
      aria-label={ASSISTANT_SHEET.title}
      aria-modal={isDocked ? undefined : true}
      hidden={!isOpen}
      tabIndex={-1}
      className={cn(
        isOpen ? "flex" : "hidden",
        "flex-col overflow-hidden border-border bg-surface-sheet text-text-primary outline-none",
        // A sheet over the whole page below the large breakpoint, and from it a 400 px panel on the right
        // under the top bar while it shows.
        "fixed inset-0 z-40 lg:inset-auto lg:bottom-0 lg:right-0 lg:top-[var(--assistant-top)] lg:z-20 lg:w-[400px] lg:border-l",
      )}
      // The top is only known at runtime (the top bar scrolls away), so a class reads it from a custom property.
      style={vars({ "--assistant-top": `${topOffset}px` })}
      onKeyDown={handleKeyDown}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <IconButton
          disabled={chat.isNewDisabled}
          icon={SquarePen}
          label={ASSISTANT_SHEET.newConversationLabel}
          onClick={() => {
            void chat.startNewConversation();
          }}
        />
        <h2 className="flex-1 text-center text-h2">{ASSISTANT_SHEET.title}</h2>
        <IconButton icon={X} label={ASSISTANT_SHEET.closeLabel} onClick={onClose} />
      </header>
      <div
        ref={threadRef}
        role="log"
        aria-live="off"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-4"
        onScroll={readScroll}
      >
        <div
          className={cn(
            "flex flex-col gap-3",
            threadClassNames[!isOpening && (isEmpty || isConsentNeeded) ? "empty" : "conversation"],
          )}
        >
          <AssistantThreadContext value={threadActions}>{renderBody()}</AssistantThreadContext>
        </div>
      </div>
      {isFieldShown ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 pb-4 pt-3">
          {isOnline ? null : (
            <Banner icon={WifiOff} title={ASSISTANT_OFFLINE.title}>
              {ASSISTANT_OFFLINE.body}
            </Banner>
          )}
          <AssistantComposer
            fieldRef={fieldRef}
            isFieldDisabled={composer.isFieldDisabled}
            isSendDisabled={!chat.canSendDraft}
            placeholder={composer.placeholder}
            value={chat.draft}
            onChange={chat.setDraft}
            onSend={chat.sendDraft}
          />
        </div>
      ) : null}
      {/* The finished answer, said once. A new element for each answer, so the same words are heard again. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement === null ? null : <p key={announcement.id}>{announcement.words}</p>}
      </div>
    </div>
  );
}
