import type { WidgetKind } from "@keylow/core/widgets";

/** The widget receivers of concepts A and B. The name is the receiver class the config plugin writes. */
export const WIDGET_PROVIDERS = [
  { kind: "today_ring", name: "TodayRing" },
  { kind: "today_macros", name: "TodayMacros" },
  { kind: "this_week", name: "ThisWeek" },
  { kind: "body_heat", name: "BodyHeat" },
  { kind: "today_glance", name: "TodayGlance" },
  { kind: "body_map", name: "BodyMap" },
  { kind: "log_grid", name: "LogGrid" },
  { kind: "today_logging", name: "TodayLogging" },
  { kind: "log_again", name: "LogAgain" },
  { kind: "weigh_in", name: "WeighIn" },
  { kind: "training", name: "Training" },
] as const satisfies readonly Readonly<{ kind: WidgetKind; name: string }>[];

/** The kind a receiver draws, or undefined for a name that is not one of the eleven. */
export const widgetKindOf = (widgetName: string): WidgetKind | undefined =>
  WIDGET_PROVIDERS.find((provider) => provider.name === widgetName)?.kind;
