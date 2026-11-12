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

// What the server does with the reads the sheet makes for an exercise the phone does not hold: it never
// answers, so the sheet keeps loading, or it fails. The exercise's form media answers with a video, with its
// photos or with nothing, for the stories of the form card, and the muscles are then never read.
type Reading = "pending" | "failed" | "video" | "photos" | "none";

const FORM_MEDIA_ROWS = {
  video: [
    {
      video_id: "abcdefghijk",
      video_title: "How to do a leg press with perfect form, step by step",
      video_channel: "Strength Basics",
      image_paths: null,
    },
  ],
  photos: [
    {
      video_id: null,
      video_title: null,
      video_channel: null,
      image_paths: ["Leg_Press/0.jpg", "Leg_Press/1.jpg"],
    },
  ],
  none: [],
} as const;

const isFormMediaRead = (input: Parameters<typeof fetch>[0]): boolean =>
  (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).includes(
    "/rpc/exercise_form_media",
  );

function answerOf(reading: Reading): typeof fetch {
  return (input) => {
    if (reading === "failed") {
      return Promise.resolve(new Response("{}", { status: 500 }));
    }
    if (reading === "pending" || !isFormMediaRead(input)) {
      return new Promise<Response>(() => undefined);
    }
    return Promise.resolve(
      new Response(JSON.stringify(FORM_MEDIA_ROWS[reading]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
}

const clientOf = (reading: Reading) =>
  createClient<Database>("http://localhost", "story-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: answerOf(reading) },
  });

const clients = {
  pending: clientOf("pending"),
  failed: clientOf("failed"),
  video: clientOf("video"),
  photos: clientOf("photos"),
  none: clientOf("none"),
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
export const Ready: Story = { render: sceneOf("none") };

// The exercise has a curated video: its card sits under the name, and pressing it opens YouTube.
export const WithVideo: Story = { render: sceneOf("video") };

// The exercise has no video, so its start and end photos stand in.
export const WithPhotos: Story = { render: sceneOf("photos") };

// The read of the form media has not answered: the card's skeleton, under the name.
export const FormLoading: Story = { render: sceneOf("pending") };

// An exercise with only a primary muscle has one row, and no secondary or assisting row.
export const PrimaryOnly: Story = {
  args: { exercise: { id: "biceps-curl", name: "Biceps Curl", muscles: bicepsCurlMuscles } },
  render: sceneOf("none"),
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
