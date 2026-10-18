import { AboutScreen } from "../components/AboutScreen";

// The root layout's AuthGate already covers this route, and the root stack gives it no header of its own.
export default function AboutRoute() {
  // KEY-278 probe, reverted in the next merge: a deliberate render error on a production bundle so the
  // first Sentry event can be checked end to end (readable stack, release, dist, scrubbing). The message
  // quotes a weight and a food on purpose, and must not appear in Sentry. Jest and Metro run with __DEV__
  // on, so tests and the dev client never hit it.
  if (!__DEV__) {
    throw new Error("KEY-278 probe: 82.4 kg Chicken breast");
  }
  return <AboutScreen />;
}
