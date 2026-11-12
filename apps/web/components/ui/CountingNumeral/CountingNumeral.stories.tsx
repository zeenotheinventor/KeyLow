import { CountingNumeral } from "./CountingNumeral";

import type { Meta, StoryObj } from "@storybook/nextjs";

const NUMERAL_CLASS_NAME = "text-display-numeral tabular-nums";

const meta = {
  title: "UI/CountingNumeral",
  component: CountingNumeral,
  decorators: [
    (Story) => (
      <div className="flex justify-center p-8">
        <Story />
      </div>
    ),
  ],
  args: { value: 1970, from: 0, className: NUMERAL_CLASS_NAME },
} satisfies Meta<typeof CountingNumeral>;

export default meta;

type Story = StoryObj<typeof meta>;

// On arrival the figure counts up from nothing and flashes the accent as it lands, as the setup estimate's does.
export const CountsUp: Story = {};

// Nothing arrived, so the figure is shown as it is and nothing moves.
export const NoArrival: Story = { args: { from: null } };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const mediaListFor = (query: string): MediaQueryList => ({
  matches: query === reducedMotionQuery,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
});

// The page is told the system's reduced motion setting is on while the story is shown: the figure is its value at
// once and nothing flashes.
export const ReducedMotion: Story = {
  beforeEach: () => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = mediaListFor;
    return () => {
      window.matchMedia = original;
    };
  },
};
