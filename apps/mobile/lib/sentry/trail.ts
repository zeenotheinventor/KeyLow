import { addBreadcrumb } from "@sentry/react-native";

import type { AppStateStatus } from "react-native";

// The route in front, as a pattern with its parameters unfilled (`/recipes/[id]/edit`), so it holds no
// id. It is kept so a report can say which screen it came from.
let currentRoute = "unknown";

export function currentRouteName(): string {
  return currentRoute;
}

/** Notes the screen the person moved to, so a blank screen has a trail of where they had been. */
export function recordRoute(route: string): void {
  addBreadcrumb({ category: "navigation", data: { from: currentRoute, to: route } });
  currentRoute = route;
}

/** Notes the app coming forward or going away, which the Sentry SDK does not note on its own. */
export function recordAppState(state: AppStateStatus): void {
  addBreadcrumb({ category: "app.state", data: { state } });
}

/** Notes the keyboard coming or going, with the edges it announced and nothing the person typed. */
export function recordKeyboard(
  event: "show" | "hide",
  { screenY, height }: { screenY: number; height: number },
): void {
  addBreadcrumb({ category: "keyboard", data: { event, screenY, height } });
}
