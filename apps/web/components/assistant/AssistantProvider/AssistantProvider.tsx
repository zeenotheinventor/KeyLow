"use client";

import { useProfileTimeZone } from "@keylow/api-client";
import { resolveAssistantTimeZone } from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssistantContext } from "./AssistantContext";

import type { AssistantOpening, AssistantProviderProps } from "./types";
import type { AssistantOpenedFrom, DescribeInLogOpening } from "@keylow/core";

import { useFoodLogActions } from "@/lib/foodLogActions";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Holds the assistant panel's open state, so the top bar's button and the panel beside the page share it
 * through `useAssistant()`. It opens on the day on view in the diary, and away from the diary on today in the
 * profile's zone (the device's until it is read). The last way the panel was opened is kept while it closes. Describe in the add food dialog opens it on the day being logged, with the time the description logs at.
 * Mount it once in the dashboard layout, inside the query and food log providers, above the top bar.
 */
export function AssistantProvider({ children }: AssistantProviderProps) {
  const { viewedDate, setAssistantDescribeOpener } = useFoodLogActions();
  const profileTimeZone = useProfileTimeZone();
  const [opening, setOpening] = useState<AssistantOpening | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeZone = resolveAssistantTimeZone(profileTimeZone.data, deviceTimeZone());

  const open = useCallback(
    (from?: AssistantOpenedFrom) => {
      setOpening({ localDate: viewedDate ?? toLocalDate(new Date(), timeZone), from });
      setIsOpen(true);
    },
    [viewedDate, timeZone],
  );
  const describe = useCallback((next: DescribeInLogOpening) => {
    setOpening({ localDate: next.localDate, describeAt: next.describeAt });
    setIsOpen(true);
  }, []);
  // The add food dialog is mounted above this provider, so this is how its Describe row reaches the panel.
  useEffect(() => {
    setAssistantDescribeOpener(describe);
    return () => {
      setAssistantDescribeOpener(undefined);
    };
  }, [describe, setAssistantDescribeOpener]);
  // Every way of closing (the Close button, Not now, Escape, the top bar's button) gives focus back to the
  // Assistant button, so it never falls to the page.
  const close = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);
  const controls = useMemo(
    () => ({ isOpen, opening, open, describe, close, buttonRef }),
    [isOpen, opening, open, describe, close],
  );

  return <AssistantContext value={controls}>{children}</AssistantContext>;
}
