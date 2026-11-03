import { keys, useSupabase } from "@keylow/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { useNow } from "../../useNow";
import { clearWidgets } from "../clearWidgets";
import { defaultWidgetBridge } from "../defaultWidgetBridge";
import { snapshotWriterFor } from "../snapshotWriter";
import { useWidgetSnapshotSource } from "../useWidgetSnapshotSource";
import { onWidgetActionDone } from "../widgetActionEvents";

import type { WidgetSyncProps } from "./types";
import type { WidgetSnapshotSource } from "../snapshotWriter";

const DEFAULT_DEBOUNCE_MILLISECONDS = 2000;

/**
 * Draws nothing. Keeps the snapshot the widgets read equal to what the dashboard shows (ADR 0007, "When the
 * app writes the snapshot"): it writes when the data changes (debounced), when the app goes to the
 * background, and after a one-tap action has written, once the data it changed is read again. When the
 * account signs out, for whatever reason, it deletes the snapshot and the pending-undo record.
 */
export function WidgetSync({
  bridge = defaultWidgetBridge,
  debounceMilliseconds = DEFAULT_DEBOUNCE_MILLISECONDS,
}: WidgetSyncProps) {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const source = useWidgetSnapshotSource(useNow());
  const writer = snapshotWriterFor(bridge);
  const latest = useRef(source);
  useEffect(() => {
    latest.current = source;
  }, [source]);
  // The source is memoised on its data, so this runs once per change and not once per render.
  const signature = useMemo(() => (source === null ? null : JSON.stringify(source)), [source]);

  // A failed write is not reported: the error could quote what was being written, which is health data.
  const write = useCallback(
    (toWrite: WidgetSnapshotSource) => {
      writer.write(toWrite).catch(() => undefined);
    },
    [writer],
  );

  useEffect(() => {
    if (signature === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (latest.current !== null) {
        write(latest.current);
      }
    }, debounceMilliseconds);

    return () => {
      clearTimeout(timer);
    };
  }, [signature, debounceMilliseconds, write]);

  // A one-tap action asks for a write once the data it changed has been read again. The write is made by
  // the render that follows, which holds the refetched source, never by a value kept from before.
  const [requestedFlush, setRequestedFlush] = useState(0);
  const flushed = useRef(0);
  useEffect(() => {
    if (requestedFlush !== flushed.current && source !== null) {
      flushed.current = requestedFlush;
      write(source);
    }
  }, [requestedFlush, source, write]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && latest.current !== null) {
        write(latest.current);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [write]);

  useEffect(
    () =>
      onWidgetActionDone(() => {
        // The action wrote a row, so what the snapshot holds about it is stale until it is read again.
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: keys.diary.all }),
          queryClient.invalidateQueries({ queryKey: keys.training.all }),
        ])
          .then(() => {
            setRequestedFlush((count) => count + 1);
          })
          .catch(() => undefined);
      }),
    [queryClient],
  );

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearWidgets(bridge).catch(() => undefined);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [client, bridge]);

  return null;
}
