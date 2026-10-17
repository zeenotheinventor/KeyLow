import { setUser } from "@sentry/react-native";

/** Tells Sentry who is signed in, by account id and nothing else, or that nobody is. */
export function identifyUser(userId: string | null) {
  setUser(userId === null ? null : { id: userId });
}
