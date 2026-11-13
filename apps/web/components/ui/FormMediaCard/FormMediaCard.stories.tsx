import { useEffect, useState } from "react";

import { FormMediaCard } from "./FormMediaCard";

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactNode } from "react";

// Each story is one state of the `web-assistant-card · exercise-form` board and the `exercise-form ·
// form-media-card` board, dark and light by the theme switch. The pictures are a neutral grey pixel, never a
// real thumbnail, and the failed one is an address that cannot load, so its tile is the placeholder.
const neutralPicture =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOISioAAAJGAS0N4IOIAAAAAElFTkSuQmCC";
const pictureThatCannotLoad = "https://form-media.invalid/missing.jpg";

const meta = {
  title: "UI/FormMediaCard",
  component: FormMediaCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormMediaCard>;

export default meta;

type Story = StoryObj<typeof FormMediaCard>;

const video = {
  kind: "video",
  title: "Barbell back squat",
  channel: "Strength Basics",
  thumbnailUrl: neutralPicture,
  watchUrl: "https://www.youtube.com/watch?v=example",
} as const;

const photos = {
  kind: "photos",
  exerciseName: "Barbell back squat",
  startUrl: neutralPicture,
  endUrl: neutralPicture,
} as const;

// A story cannot reach the system's setting, so this answers reduced motion as on while it is drawn. It is set
// while rendering, before the card reads it, and put back when the story goes.
function ReducedMotionOn({ children }: { children: ReactNode }) {
  const [original] = useState(() => {
    const read = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const list = read(query);
      if (query === "(prefers-reduced-motion: reduce)") {
        Object.defineProperty(list, "matches", { value: true });
      }
      return list;
    };
    return read;
  });
  useEffect(
    () => () => {
      window.matchMedia = original;
    },
    [original],
  );
  return children;
}

// A short title takes one line.
export const VideoShortTitle: Story = { args: video };

// The title stops at two lines.
export const VideoTwoLineTitle: Story = {
  args: {
    ...video,
    title: "How to do a barbell back squat with perfect form, step by step",
  },
};

// The start and the end photo take turns, crossfading.
export const PhotosAlternating: Story = { args: photos };

// With reduced motion on, both photos sit side by side and nothing moves.
export const PhotosReduceMotion: Story = {
  args: photos,
  decorators: [
    (Story) => (
      <ReducedMotionOn>
        <Story />
      </ReducedMotionOn>
    ),
  ],
};

export const Loading: Story = { args: { kind: "loading" } };

export const Unavailable: Story = { args: { kind: "unavailable" } };

// A poster that does not load shows the placeholder tile, and the card still opens the video.
export const ImageFailed: Story = { args: { ...video, thumbnailUrl: pictureThatCannotLoad } };
