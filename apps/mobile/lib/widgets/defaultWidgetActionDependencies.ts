import { createWidgetRepositories } from "./createWidgetRepositories";
import { defaultWidgetBridge } from "./defaultWidgetBridge";
import { probeConnection } from "../connectivity/probeConnection";
import { supabase } from "../supabase";

import type { WidgetActionDependencies } from "./actions";

/**
 * What a task handler passes to `logAgain`, `logNextSet` and `undoLast`: the app's Supabase client with its
 * stored session, the shared bridge, and a probe of the server in place of React Query's online manager,
 * which only the running app feeds.
 */
export function defaultWidgetActionDependencies(): WidgetActionDependencies {
  // Metro inlines the variable only where it is read by its full name.
  const configuredUrl: unknown = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serverUrl = typeof configuredUrl === "string" ? configuredUrl : "";

  return {
    repositories: createWidgetRepositories(supabase),
    bridge: defaultWidgetBridge,
    isOnline: () => probeConnection(serverUrl),
    now: () => new Date(),
  };
}
