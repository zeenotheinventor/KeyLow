import { useActiveSession, useStartSessionAction, useTrainHome } from "@keylow/api-client";
import { resolveStartLink } from "@keylow/core/widgets";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";

import { useNow } from "../useNow";
import { useReadsEnabled } from "../useReadsEnabled";
import { defaultWidgetBridge } from "./defaultWidgetBridge";
import { snapshotWriterFor } from "./snapshotWriter";

import type { WidgetBridge } from "./types";

const doNothing = () => undefined;

/**
 * Handles `/session?start=planned&nonce=...` and `/session?start=empty&nonce=...`, the links the Training
 * widget opens. A link starts something only when its nonce is the one in the snapshot the app last wrote
 * and has not been used: before it starts anything the stored snapshot gets a fresh nonce, so the used one is
 * unknown on every later read, a relaunch included, and the redrawn widget carries the new one (a failed start
 * leaves the button live). With a session already running it opens that one (the screen shows it), and an
 * unknown nonce does nothing at all. The link is read once, when the reads it needs have answered.
 */
export function useWidgetStartLink(bridge: WidgetBridge = defaultWidgetBridge): void {
  const { start, nonce } = useLocalSearchParams<{ start?: string; nonce?: string }>();
  const enabled = useReadsEnabled();
  const session = useActiveSession({ enabled: enabled && start !== undefined });
  const home = useTrainHome({ now: useNow(), enabled: enabled && start !== undefined });
  const startSession = useStartSessionAction({ onStarted: doNothing, onFailure: doNothing });
  const isHandled = useRef(false);

  useEffect(() => {
    if (start === undefined || isHandled.current) {
      return;
    }
    if (session.data === undefined || home.status !== "ready") {
      return;
    }
    isHandled.current = true;
    const hasRunningSession = session.data !== null;
    const plannedDayId = home.today?.plannedDayId ?? null;
    const { timeZone } = home;

    void bridge
      .readSnapshot()
      .then((source) => {
        const snapshotNonce = source.status === "ready" ? source.snapshot.nonce : null;
        const decision = resolveStartLink({
          start,
          nonce,
          snapshotNonce,
          hasRunningSession,
          plannedDayId,
        });
        if (decision.type !== "start") {
          return undefined;
        }
        return snapshotWriterFor(bridge)
          .rotate()
          .then(() => {
            startSession.start({ routineDayId: decision.routineDayId, timeZone });
          });
      })
      .catch(doNothing);
  }, [start, nonce, session.data, home, bridge, startSession]);
}
