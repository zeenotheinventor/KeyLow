import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { newLiveTurn, failedTurn } from "../assistantLiveTurn";
import { invalidateAssistantWrites } from "../invalidateAssistantWrites";
import { useFunctionsUrl, useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { runAssistantTurn } from "../runAssistantTurn";

import type { AssistantLiveTurn } from "../assistantLiveTurn";
import type { Database } from "../database.types";
import type { SkippedKind, StreamingFetch } from "../runAssistantTurn";
import type { SupabaseClient } from "@supabase/supabase-js";

// The access token of the session, or null when there is none or it cannot be read.
async function readAccessToken(client: SupabaseClient<Database>): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

type SendOptions = {
  /** The day the sheet was opened on, in the person's time zone, `YYYY-MM-DD`. */
  localDate: string;
  /** The hour of the Describe hint, `HH:MM`. */
  localTime?: string | null | undefined;
  /**
   * The conversation to send into, always named by the caller: the id of the turn on screen
   * (`live.conversationId`) or of the thread the sheet reopened on, or `null` for a new conversation. The
   * hook keeps no conversation of its own, so a dead id (after Delete all, or one that is not the person's)
   * is never reused behind the caller's back.
   */
  conversationId: string | null;
};

/**
 * Sends a message to the assistant and reads the answer as it streams, for the assistant sheet.
 * `fetch` is injected: the app passes the `fetch` of `expo/fetch`, because React Native's own cannot read a
 * body as it arrives.
 *
 * - `send` posts the message, and does nothing while a turn is streaming.
 * - `stop` aborts the request and keeps the text that arrived, marked `stopped`. Unmounting aborts too.
 * - `live` is the turn being written, or null before the first send. A network failure, a refused request
 *   or an event the app cannot read gives the `turn_failed` notice and never throws.
 * - An event type or card kind this app does not know is skipped and the turn goes on, with its name given to
 *   `onKindSkipped` (the phone leaves a breadcrumb with it).
 * - `isStreaming` is true from the send to the end of the stream.
 *
 * Once the answer was an event stream, the function may have written, so when the turn ends (done, stopped
 * or dropped) the conversation, the changes and the status are read again, and so are the diary, recipes,
 * foods and targets. A refused request changes nothing. A notice in the stream is the authority over the
 * status read: a day limit shows even when the status said the assistant was open.
 */
export function useAssistantTurn({
  fetch,
  onKindSkipped,
}: {
  fetch: StreamingFetch;
  onKindSkipped?: ((skipped: SkippedKind) => void) | undefined;
}) {
  const client = useSupabase();
  const functionsUrl = useFunctionsUrl();
  const queryClient = useQueryClient();
  const [live, setLive] = useState<AssistantLiveTurn | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  // Refs, not state, so two sends in one tick still see that the first is running.
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (text: string, { localDate, localTime, conversationId }: SendOptions) => {
      if (controllerRef.current !== null) {
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      const show = (next: AssistantLiveTurn) => {
        if (mountedRef.current) {
          setLive(next);
        }
      };

      try {
        setIsStreaming(true);
        show(newLiveTurn());

        const accessToken = await readAccessToken(client);
        if (accessToken === null) {
          show(failedTurn(newLiveTurn()));
          return;
        }

        const { live: ended, streamed } = await runAssistantTurn(
          {
            fetch,
            turnUrl: `${functionsUrl}/assistant/turn`,
            accessToken,
            request: { conversationId, text, localDate, localTime: localTime ?? null },
            signal: controller.signal,
            onKindSkipped,
          },
          show,
        );
        show(ended);

        // Not awaited: the turn is over, and the screens read again in their own time.
        if (streamed) {
          void queryClient.invalidateQueries({ queryKey: keys.assistant.conversation });
          void queryClient.invalidateQueries({ queryKey: keys.assistant.changes });
          void queryClient.invalidateQueries({ queryKey: keys.assistant.status });
          void invalidateAssistantWrites(queryClient);
        }
      } finally {
        // However the send ended, the next one is not blocked by this one.
        controllerRef.current = null;
        if (mountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
    [client, fetch, functionsUrl, onKindSkipped, queryClient],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { send, stop, live, isStreaming };
}
