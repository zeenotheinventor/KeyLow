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

// How far from the top of the thread, in px, a scroll of the person's own starts loading older turns.
const NEAR_THE_TOP_DISTANCE = 300;

// The thread grows up from the composer once there is a conversation, and starts at the top when it is the
// empty state's words or the consent card.
const threadClassNames = {
  conversation: "mt-auto",
  empty: "",
} as const;

type ThreadLayout = { scrollHeight: number; firstKey: string | undefined; isLoading: boolean };

// Moves the thread to `top`, and says where it ended up when that moved it, or null when it was already there
// (no scroll event follows then).
function writeScrollTop(element: HTMLDivElement, top: number): number | null {
  const previousTop = element.scrollTop;
  element.scrollTop = top;
  return element.scrollTop === previousTop ? null : element.scrollTop;
}

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
  describeAt,
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
  // The scroll position the panel itself last wrote, so the scroll event that write causes is not read as
  // the person's own scroll. Only the person's scroll changes what is followed or loads older turns.
  const lastWrittenTop = useRef<number | null>(null);
  // How the thread was laid out after the last render, to keep the view in place when turns or the loading
  // placeholder arrive above it.
  const lastLayout = useRef<ThreadLayout | undefined>(undefined);
  const threadRef = useRef<HTMLDivElement>(null);
  const threadContentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const chat = useAssistantChat({
    open: isOpen,
    localDate,
    describeAt,
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
  // somewhere else on the page is left alone, as is a field that is off. Describe is the exception, for its
  // opening: it opens the panel from a dialog that has just closed and given focus back to the page, so the field is
  // where focus goes whatever the page holds.
  const hasFocusedDescribe = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasFocusedDescribe.current = false;
      return;
    }
    // Once for the opening: a field that appears later (consent given, a limit cleared) is not a reason to
    // take focus from where the person has gone.
    const isDescribeOpening = describeAt !== undefined && !hasFocusedDescribe.current;
    hasFocusedDescribe.current = hasFocusedDescribe.current || describeAt !== undefined;
    const focused = document.activeElement;
    const isFocusFree =
      isDescribeOpening ||
      focused === null ||
      focused === document.body ||
      focused === buttonRef.current ||
      panelRef.current?.contains(focused) === true;
    if (isFocusFree) {
      (isFieldShown ? fieldRef.current : panelRef.current)?.focus();
    }
  }, [isOpen, isFieldShown, buttonRef, describeAt]);

  const firstKey = thread.entries[0]?.key;
  const isLoadingOlder = chat.isLoadingOlder;

  // The thread follows its end as it grows, unless the person scrolled up. Scrolled up, what arrives above
  // the view (the loading placeholder, then the older turns) moves everything down, and the browser's own
  // scroll anchoring is off for the thread, so the view is moved by the same height to stay on what was read.
  useLayoutEffect(() => {
    const element = threadRef.current;
    if (element === null) {
      return;
    }
    const before = lastLayout.current;
    const isAddedAbove =
      before !== undefined && (before.firstKey !== firstKey || before.isLoading !== isLoadingOlder);
    if (isFollowingEnd.current) {
      lastWrittenTop.current =
        writeScrollTop(element, element.scrollHeight) ?? lastWrittenTop.current;
    } else if (isAddedAbove) {
      lastWrittenTop.current =
        writeScrollTop(element, element.scrollTop + element.scrollHeight - before.scrollHeight) ??
        lastWrittenTop.current;
    }
    lastLayout.current = {
      scrollHeight: element.scrollHeight,
      firstKey,
      isLoading: isLoadingOlder,
    };
  });

  // The loading placeholder's bones show a moment after it does, which grows the thread above the view
  // without a render, so the view is moved for that growth too.
  useEffect(() => {
    const element = threadRef.current;
    const content = threadContentRef.current;
    if (element === null || content === null || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      const before = lastLayout.current;
      if (before === undefined || !before.isLoading || isFollowingEnd.current) {
        return;
      }
      lastWrittenTop.current =
        writeScrollTop(element, element.scrollTop + element.scrollHeight - before.scrollHeight) ??
        lastWrittenTop.current;
      lastLayout.current = { ...before, scrollHeight: element.scrollHeight };
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
    };
  }, []);

  function readScroll() {
    const element = threadRef.current;
    if (element === null) {
      return;
    }
    if (lastWrittenTop.current === element.scrollTop) {
      lastWrittenTop.current = null;
      return;
    }
    lastWrittenTop.current = null;
    isFollowingEnd.current =
      element.scrollHeight - element.clientHeight - element.scrollTop <= NEAR_THE_END_DISTANCE;
    // Reading up towards older turns is never followed back to the end, even in a thread short enough for
    // the top and the end to be within reach of each other, and the turns that load must not pull the view.
    if (chat.hasOlder && element.scrollTop <= NEAR_THE_TOP_DISTANCE) {
      isFollowingEnd.current = false;
      if (!chat.isLoadingOlder) {
        chat.loadOlder();
      }
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
          describeAt={describeAt}
          from={from}
          isDisabled={chat.isStarterDisabled}
          onStarterPress={chat.sendMessage}
        />
      );
    }
    return (
      <>
        {chat.isLoadingOlder ? <AssistantOpening key="older-turns-placeholder" /> : null}
        <AssistantThread thread={thread} />
      </>
    );
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
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-4 [overflow-anchor:none]"
        onScroll={readScroll}
      >
        <div
          ref={threadContentRef}
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
            hint={composer.hint}
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
