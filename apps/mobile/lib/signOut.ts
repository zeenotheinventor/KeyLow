import { endSession } from "./endSession";
import { removeStoredSession, supabase } from "./supabase";

/** Signs the person out of the app. Every sign out button calls this and not `supabase.auth.signOut`. */
export function signOut(): Promise<void> {
  return endSession(supabase.auth, removeStoredSession);
}
