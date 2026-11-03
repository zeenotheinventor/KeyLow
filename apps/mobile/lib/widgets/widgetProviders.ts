import type { WidgetKind } from "@keylow/core/widgets";

/** The widget receivers of concept A. The name is the receiver class the config plugin writes. */
export const DASHBOARD_WIDGET_PROVIDERS = [
  { kind: "today_ring", name: "TodayRing" },
  { kind: "today_macros", name: "TodayMacros" },
  { kind: "this_week", name: "ThisWeek" },
  { kind: "body_heat", name: "BodyHeat" },
  { kind: "today_glance", name: "TodayGlance" },
  { kind: "body_map", name: "BodyMap" },
] as const satisfies readonly Readonly<{ kind: WidgetKind; name: string }>[];

export type DashboardWidgetKind = (typeof DASHBOARD_WIDGET_PROVIDERS)[number]["kind"];

/** The kind a receiver draws, or undefined for a name that is not one of the six. */
export const dashboardKindOf = (widgetName: string): DashboardWidgetKind | undefined =>
  DASHBOARD_WIDGET_PROVIDERS.find((provider) => provider.name === widgetName)?.kind;
