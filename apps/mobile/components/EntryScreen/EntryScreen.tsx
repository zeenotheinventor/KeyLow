import { useLogEntry, useProfileTimeZone } from "@keylow/api-client";
import { ENTRY_SCREEN } from "@keylow/core/copy";
import { isEntryId } from "@keylow/core/diary";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";

import { FoodEntryForm } from "./FoodEntryForm";
import { QuickEntryForm } from "./QuickEntryForm";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { EntryLoadState } from "../EntryLoadState";

import type { EntryScreenProps } from "./types";
import type { LogEntry } from "@keylow/api-client";

/**
 * What a diary row opens: a logged food or a quick add, by the entry's id (a recipe entry has no screen yet). It waits for the entry and for
 * the profile's time zone, which the time is read in, and draws the food's form or the quick add's. Nothing
 * is read while the terms gate is up. Back, a save and a delete return to where the user came from, once: a second way out, such as a
 * save that finishes after Back was pressed, would go back past it.
 */
export function EntryScreen({ id }: EntryScreenProps) {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const isValidId = isEntryId(id);
  const entry = useLogEntry(id, { enabled: isReadEnabled && isValidId });
  const profileTimeZone = useProfileTimeZone({ enabled: isReadEnabled });

  const hasLeft = useRef(false);
  // The entry on screen when the screen started to leave. A delete from this screen marks the entry gone in
  // the cache while the screen is still up for the way out, and it keeps showing this entry, not "Entry not found".
  const [entryLeftWith, setEntryLeftWith] = useState<LogEntry | null>(null);
  const shownEntry = entry.data === null && entryLeftWith !== null ? entryLeftWith : entry.data;

  function leave() {
    if (hasLeft.current) {
      return;
    }
    hasLeft.current = true;
    if (entry.data !== undefined && entry.data !== null) {
      setEntryLeftWith(entry.data);
    }
    // A cold link to this screen has nothing before it, so the user goes to the diary instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/diary");
    }
  }

  function renderState(state: "loading" | "error" | "notFound") {
    return (
      <EntryLoadState
        state={state}
        title={ENTRY_SCREEN.title}
        onBack={leave}
        onRetry={() => {
          void Promise.all([
            entry.isError ? entry.refetch() : undefined,
            profileTimeZone.isError ? profileTimeZone.refetch() : undefined,
          ]);
        }}
      />
    );
  }

  if (!isValidId) {
    return renderState("notFound");
  }
  if ((entry.isError && entry.data === undefined) || profileTimeZone.isError) {
    return renderState("error");
  }
  // An entry the cache already holds is not drawn while the terms gate is up: nothing of the diary is.
  if (!isReadEnabled || shownEntry === undefined || profileTimeZone.data === undefined) {
    return renderState("loading");
  }
  // A recipe entry has no screen yet, so a link to one shows the same as an entry that is not there.
  if (shownEntry === null || shownEntry.item_type === "recipe") {
    return renderState("notFound");
  }

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const timeZone = profileTimeZone.data ?? "UTC";

  return shownEntry.item_type === "food" ? (
    <FoodEntryForm entry={shownEntry} timeZone={timeZone} onLeave={leave} />
  ) : (
    <QuickEntryForm entry={shownEntry} timeZone={timeZone} onLeave={leave} />
  );
}
