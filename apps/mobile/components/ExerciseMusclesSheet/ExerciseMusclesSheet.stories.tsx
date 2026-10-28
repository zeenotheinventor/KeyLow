import { KeyLowProvider, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ExerciseMusclesSheet } from "./ExerciseMusclesSheet";

import type { ExerciseMusclesSheetProps } from "./types";
import type { Database } from "@keylow/api-client";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { Meta, StoryObj } from "@storybook/react-native";

// The Leg Press as the exercise library has it, as the board draws it: quads primary, glutes and hamstrings
// secondary, calves assisting.
const legPressMuscles: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
  { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
];
const bicepsCurlMuscles: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "biceps", role: "primary", weight: 1 },
];

const legPressId = "00000000-0000-4000-8000-000000000a01";

// What the server does with the read of an exercise the phone does not hold: it never answers, so the sheet
// keeps loading, or it fails.
type Reading = "pending" | "failed";

const clients = {
  pending: createClient<Database>("http://localhost", "story-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: () => new Promise<Response>(() => undefined) },
  }),
  failed: createClient<Database>("http://localhost", "story-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: () => Promise.resolve(new Response("{}", { status: 500 })) },
  }),
};

// The stories read through the same hook as the app. The terms are accepted in the cache, so the read is
// allowed.
function acceptedQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  queryClient.setQueryData(keys.profiles.termsAcceptance, {
    terms_accepted_at: "2026-10-15T09:30:00+00:00",
    terms_version: TERMS_VERSION,
  });

  return queryClient;
}

type SceneProps = ExerciseMusclesSheetProps & { reading: Reading; isOffline: boolean };

function Scene({ reading, isOffline, ...props }: SceneProps) {
  const [queryClient] = useState(acceptedQueryClient);

  // The phone is offline for as long as the story is on show.
  useEffect(() => {
    if (!isOffline) {
      return undefined;
    }
    onlineManager.setOnline(false);
    return () => {
      onlineManager.setOnline(true);
    };
  }, [isOffline]);

  return (
    <KeyLowProvider client={clients[reading]} queryClient={queryClient}>
      <ExerciseMusclesSheet {...props} />
    </KeyLowProvider>
  );
}

const meta = {
  title: "Training/ExerciseMusclesSheet",
  component: ExerciseMusclesSheet,
  args: {
    exercise: { id: legPressId, name: "Leg Press", muscles: legPressMuscles },
    onClose: () => undefined,
  },
} satisfies Meta<typeof ExerciseMusclesSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

function sceneOf(reading: Reading, isOffline = false): NonNullable<Story["render"]> {
  return function Render(args) {
    return <Scene {...args} isOffline={isOffline} reading={reading} />;
  };
}

// The board `session · exercise-muscles`. The scheme comes from the theme toolbar.
export const Ready: Story = { render: sceneOf("pending") };

// An exercise with only a primary muscle has one row, and no secondary or assisting row.
export const PrimaryOnly: Story = {
  args: { exercise: { id: "biceps-curl", name: "Biceps Curl", muscles: bicepsCurlMuscles } },
  render: sceneOf("pending"),
};

// The phone holds no map for the exercise and the read has not answered: the figures at rest and two bones.
export const Loading: Story = {
  args: { exercise: { id: legPressId, name: "Leg Press", muscles: null } },
  render: sceneOf("pending"),
};

// No map and no connection: the figures at rest and the line that says the muscles are not available offline.
export const Offline: Story = {
  args: { exercise: { id: legPressId, name: "Leg Press", muscles: null } },
  render: sceneOf("pending", true),
};

export const Failed: Story = {
  args: { exercise: { id: legPressId, name: "Leg Press", muscles: null } },
  render: sceneOf("failed"),
};
