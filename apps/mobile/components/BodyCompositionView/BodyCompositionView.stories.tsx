import { KeyLowProvider, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { addCalendarDays } from "@keylow/core/dates";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { BodyCompositionView } from "./BodyCompositionView";

import type { BodyCompositionViewProps } from "./types";
import type { BodyMeasurement, Database } from "@keylow/api-client";
import type { TrendPoint } from "@keylow/core/engine";
import type { BodyMeasurementKind } from "@keylow/core/weight";
import type { Meta, StoryObj } from "@storybook/react-native";

const today = "2026-10-23";
const dayOf = (daysAgo: number) => addCalendarDays(today, -daysAgo);

// The weight trend the trend card would give the view: one point a day, falling slowly.
function weightTrend(days: number): TrendPoint[] {
  return Array.from({ length: days }, (_, index) => {
    const trendKg = 82 - index * 0.012;
    return {
      date: dayOf(days - 1 - index),
      segment: 0,
      trendKg,
      rawKg: trendKg,
      usedKg: trendKg,
      rejected: false,
      winsorised: false,
      interpolated: false,
      nObs: index + 1,
    };
  });
}

// One reading a day for `days` days, newest first as the list reads them, made up for the story.
function readings(kind: BodyMeasurementKind, days: number): BodyMeasurement[] {
  return Array.from({ length: days }, (_, daysAgo) => ({
    id: `00000000-0000-4000-8000-${String(daysAgo).padStart(12, "0")}`,
    kind,
    measured_at: `${dayOf(daysAgo)}T07:00:00+00:00`,
    local_date: dayOf(daysAgo),
    tz: "Europe/London",
    value:
      kind === "body_fat_pct"
        ? 22.6 + daysAgo * 0.005 + Math.sin(daysAgo * 0.4) * 0.1
        : 63.5 - daysAgo * 0.002 + Math.cos(daysAgo * 0.3) * 0.15,
    source: "health_connect",
  }));
}

type StoryReadings = Partial<Record<BodyMeasurementKind, BodyMeasurement[]>>;

// The stories read through the same hooks as the app, from a cache that is filled before it is drawn and
// never goes stale. A kind with no entry is read from this client, whose network refuses every request, so
// it shows the error state.
const refusingClient = createClient<Database>("http://localhost", "story-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: () => Promise.resolve(new Response("{}", { status: 500 })) },
});

function filledQueryClient(inCache: StoryReadings): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  queryClient.setQueryData(keys.profiles.termsAcceptance, {
    terms_accepted_at: "2026-10-15T09:30:00+00:00",
    terms_version: TERMS_VERSION,
  });
  for (const kind of ["body_fat_pct", "lean_mass_kg"] as const) {
    const list = inCache[kind];
    if (list !== undefined) {
      queryClient.setQueryData(keys.bodyMeasurements.list(kind), list);
    }
  }

  return queryClient;
}

type SceneProps = BodyCompositionViewProps & { inCache: StoryReadings };

// Holds the unit so the switch works in the story.
function Scene({ inCache, unit: firstUnit, ...props }: SceneProps) {
  const [queryClient] = useState(() => filledQueryClient(inCache));
  const [unit, setUnit] = useState(firstUnit);

  return (
    <KeyLowProvider client={refusingClient} queryClient={queryClient}>
      <View className="flex-1 justify-center p-4">
        <BodyCompositionView {...props} unit={unit} onUnitChange={setUnit} />
      </View>
    </KeyLowProvider>
  );
}

const bodyFatOnly: StoryReadings = {
  body_fat_pct: readings("body_fat_pct", 100),
  lean_mass_kg: [],
};
const leanMassOnly: StoryReadings = {
  body_fat_pct: [],
  lean_mass_kg: readings("lean_mass_kg", 100),
};
const threeReadings: StoryReadings = {
  body_fat_pct: readings("body_fat_pct", 3),
  lean_mass_kg: [],
};
const noReadings: StoryReadings = { body_fat_pct: [], lean_mass_kg: [] };

const meta = {
  title: "Weight/BodyCompositionView",
  component: BodyCompositionView,
  args: {
    connection: "connected",
    access: { bodyFat: true, leanMass: true },
    weightPoints: weightTrend(100),
    range: 90,
    today,
    unit: "kg",
    onUnitChange: () => undefined,
  },
} satisfies Meta<typeof BodyCompositionView>;

export default meta;

type Story = StoryObj<typeof meta>;

function sceneOf(inCache: StoryReadings): NonNullable<Story["render"]> {
  return function Render(args) {
    return <Scene inCache={inCache} {...args} />;
  };
}

// The scheme comes from the theme toolbar. Body fat drives, so the source line says body fat.
export const BodyFatKilograms: Story = { render: sceneOf(bodyFatOnly) };
export const BodyFatPercent: Story = { args: { unit: "pct" }, render: sceneOf(bodyFatOnly) };

// Lean mass drives: only lean mass is allowed, and the source line says lean mass.
export const LeanMassKilograms: Story = {
  args: { access: { bodyFat: false, leanMass: true } },
  render: sceneOf(leanMassOnly),
};
export const LeanMassPercent: Story = {
  args: { access: { bodyFat: false, leanMass: true }, unit: "pct" },
  render: sceneOf(leanMassOnly),
};

// Three body fat readings: the Settling badge, and both lines dashed.
export const SettlingKilograms: Story = {
  args: { weightPoints: weightTrend(3) },
  render: sceneOf(threeReadings),
};
export const SettlingPercent: Story = {
  args: { weightPoints: weightTrend(3), unit: "pct" },
  render: sceneOf(threeReadings),
};

// The prompts have no switch, so each has one story.
export const NotConnected: Story = {
  args: { connection: "not-connected", access: null },
  render: sceneOf(noReadings),
};
export const NotAllowed: Story = {
  args: { access: { bodyFat: false, leanMass: false } },
  render: sceneOf(noReadings),
};
export const Loading: Story = { args: { access: null }, render: sceneOf(noReadings) };
export const LoadError: Story = { render: sceneOf({}) };
export const NoReadingsYet: Story = { render: sceneOf(noReadings) };
