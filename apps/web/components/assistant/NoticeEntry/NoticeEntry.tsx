"use client";

import { describeAssistantNotice } from "@keylow/core/copy";
import { CircleAlert, Clock, Lock, Moon, PowerOff } from "lucide-react";

import { useAssistantThreadActions } from "../AssistantThread";

import type { NoticeEntryProps } from "./types";
import type { AssistantNoticeTone } from "@/components/ui/AssistantNotice";
import type { LucideIcon } from "lucide-react";

import { AssistantNotice } from "@/components/ui/AssistantNotice";

// Each notice has its board's glyph. The failed turn is the one with the danger tone.
const noticeLooks: Record<
  NoticeEntryProps["entry"]["notice"]["code"],
  { icon: LucideIcon; tone: AssistantNoticeTone }
> = {
  day_limit: { icon: Clock, tone: "neutral" },
  plus: { icon: Lock, tone: "neutral" },
  resting: { icon: Moon, tone: "neutral" },
  switched_off: { icon: PowerOff, tone: "neutral" },
  turn_failed: { icon: CircleAlert, tone: "danger" },
};

/**
 * The thread's `notice` entry (`web-assistant · day-limit`, `plus`, `resting`, `unavailable`): a limit, the
 * assistant switched off, or a failed turn. Core words it. Only the latest notice offers its button, which
 * sends the last message again.
 */
export function NoticeEntry({ entry }: NoticeEntryProps) {
  const { timeZone, onSendAgain } = useAssistantThreadActions();
  const words = describeAssistantNotice(entry.notice, timeZone);
  const look = noticeLooks[entry.notice.code];

  return (
    <AssistantNotice
      buttons={
        entry.isLatest && words.button !== null
          ? [{ label: words.button, onClick: onSendAgain }]
          : []
      }
      icon={look.icon}
      paragraphs={[words.body]}
      title={words.title}
      tone={look.tone}
    />
  );
}
