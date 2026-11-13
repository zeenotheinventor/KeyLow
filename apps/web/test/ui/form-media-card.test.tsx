import { EXERCISE_FORM, describeFormPhoto, describeFormVideoLink } from "@keylow/core/copy";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FormMediaCardProps } from "@/components/ui/FormMediaCard";

import { FormMediaCard } from "@/components/ui/FormMediaCard";

const video = {
  kind: "video",
  title: "Barbell back squat",
  channel: "Strength Basics",
  thumbnailUrl: "https://thumbnails.test/squat.jpg",
  watchUrl: "https://videos.test/watch?v=abcdefghijk",
} satisfies FormMediaCardProps;

const photos = {
  kind: "photos",
  exerciseName: "Barbell back squat",
  startUrl: "https://photos.test/0.jpg",
  endUrl: "https://photos.test/1.jpg",
} satisfies FormMediaCardProps;

// jsdom has no media queries, so a test says whether the person asked for reduced motion, and can change it
// while the card is on screen.
let isReducedMotion = false;
const motionListeners = new Set<() => void>();

function setReducedMotion(isReduced: boolean) {
  isReducedMotion = isReduced;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return isReducedMotion && query === "(prefers-reduced-motion: reduce)";
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      motionListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      motionListeners.delete(listener);
    },
  }));
}

describe("FormMediaCard", () => {
  beforeEach(() => {
    setReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    motionListeners.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("video", () => {
    it("should be one link named by what it plays, who made it and where it opens", () => {
      render(<FormMediaCard {...video} />);

      expect(
        screen.getByRole("link", { name: describeFormVideoLink(video.title, video.channel) }),
      ).toBeTruthy();
    });

    it("should open the watch address in a new tab without handing over the opener", () => {
      render(<FormMediaCard {...video} />);

      const link = screen.getByRole("link", {
        name: describeFormVideoLink(video.title, video.channel),
      });

      expect(link.getAttribute("href")).toBe(video.watchUrl);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("should ask for the poster without a referrer", () => {
      render(<FormMediaCard {...video} />);

      expect(screen.getByRole("img", { name: video.title }).getAttribute("referrerpolicy")).toBe(
        "no-referrer",
      );
    });

    it("should draw the poster from the thumbnail address and say where it opens", () => {
      render(<FormMediaCard {...video} />);

      expect(screen.getByRole("img", { name: video.title }).getAttribute("src")).toBe(
        video.thumbnailUrl,
      );
      expect(screen.getByText(EXERCISE_FORM.opensInYouTube)).toBeTruthy();
      expect(screen.getByText(video.channel)).toBeTruthy();
    });

    it("should offer no player to press, because nothing plays in Ki-Lo", () => {
      render(<FormMediaCard {...video} />);

      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("should swap a poster that fails for the placeholder and keep the link", () => {
      render(<FormMediaCard {...video} />);

      fireEvent.error(screen.getByRole("img", { name: video.title }));

      expect(screen.getByRole("img", { name: EXERCISE_FORM.imageFailedName })).toBeTruthy();
      expect(
        screen.getByRole("link", { name: describeFormVideoLink(video.title, video.channel) }),
      ).toBeTruthy();
    });
  });

  describe("photos", () => {
    it("should name each photo and badge it Start and End", () => {
      render(<FormMediaCard {...photos} />);

      expect(
        screen
          .getByRole("img", { name: describeFormPhoto(photos.exerciseName, "start") })
          .getAttribute("src"),
      ).toBe(photos.startUrl);
      expect(
        screen
          .getByRole("img", { name: describeFormPhoto(photos.exerciseName, "end") })
          .getAttribute("src"),
      ).toBe(photos.endUrl);
      expect(screen.getByText(EXERCISE_FORM.startLabel)).toBeTruthy();
      expect(screen.getByText(EXERCISE_FORM.endLabel)).toBeTruthy();
    });

    it("should start on the start photo, fade the end photo in over it and out again", () => {
      vi.useFakeTimers();
      render(<FormMediaCard {...photos} />);
      const endLayer = screen.getByRole("img", {
        name: describeFormPhoto(photos.exerciseName, "end"),
      }).parentElement?.parentElement;

      expect(endLayer?.className).toContain("opacity-0");

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(endLayer?.className).toContain("opacity-100");

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(endLayer?.className).toContain("opacity-0");
    });

    it("should stop its loop when the card goes", () => {
      vi.useFakeTimers();
      const { unmount } = render(<FormMediaCard {...photos} />);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("should set both photos side by side and keep them still under reduced motion", () => {
      setReducedMotion(true);
      vi.useFakeTimers();
      const { container } = render(<FormMediaCard {...photos} />);

      expect(container.innerHTML).not.toContain("opacity-0");
      expect(vi.getTimerCount()).toBe(0);
      expect(screen.getByText(EXERCISE_FORM.startLabel)).toBeTruthy();
      expect(screen.getByText(EXERCISE_FORM.endLabel)).toBeTruthy();
    });

    it("should ask for both photos without a referrer", () => {
      render(<FormMediaCard {...photos} />);

      for (const position of ["start", "end"] as const) {
        expect(
          screen
            .getByRole("img", { name: describeFormPhoto(photos.exerciseName, position) })
            .getAttribute("referrerpolicy"),
        ).toBe("no-referrer");
      }
    });

    it("should switch to side by side and stop its loop when reduced motion is turned on", () => {
      vi.useFakeTimers();
      const { container } = render(<FormMediaCard {...photos} />);
      expect(vi.getTimerCount()).toBe(1);

      act(() => {
        setReducedMotion(true);
        motionListeners.forEach((listener) => {
          listener();
        });
      });

      expect(container.innerHTML).not.toContain("opacity-0");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("should swap a photo that fails for the placeholder", () => {
      render(<FormMediaCard {...photos} />);

      fireEvent.error(
        screen.getByRole("img", { name: describeFormPhoto(photos.exerciseName, "start") }),
      );

      expect(screen.getByRole("img", { name: EXERCISE_FORM.imageFailedName })).toBeTruthy();
    });
  });

  it("should say it is loading the form guide", () => {
    render(<FormMediaCard kind="loading" />);

    expect(screen.getByRole("status", { name: EXERCISE_FORM.loadingName })).toBeTruthy();
  });

  it("should say the form guide is unavailable in one quiet line", () => {
    render(<FormMediaCard kind="unavailable" />);

    expect(screen.getByRole("status").textContent).toBe(EXERCISE_FORM.unavailable);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
