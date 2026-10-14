import { AboutScreen } from "../components/AboutScreen";

// The root layout's AuthGate already covers this route, and the root stack gives it no header of its own.
export default function AboutRoute() {
  return <AboutScreen />;
}
