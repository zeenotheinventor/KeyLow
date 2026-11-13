import {
  EXERCISE_FORM,
  FORM_MEDIA_SWITCH,
  describeFormPhoto,
  describeFormVideoLink,
} from "@keylow/core/copy";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { openURL } from "expo-linking";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { FormMediaCard } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { FormMediaCardProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
setUpTests();
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));

const openURLMock = jest.mocked(openURL);

const video = {
  kind: "video",
  title: "Barbell back squat, step by step",
  channel: "Strength Basics",
  thumbnailUrl: "https://example.test/thumbnail.jpg",
  watchUrl: "https://www.youtube.com/watch?v=abc123",
} as const;

const photos = {
  kind: "photos",
  exerciseName: "Barbell back squat",
  startUrl: "https://example.test/start.jpg",
  endUrl: "https://example.test/end.jpg",
} as const;

const startName = describeFormPhoto(photos.exerciseName, "start");
const endName = describeFormPhoto(photos.exerciseName, "end");

// The crossfade has no role to query it by, so the layer the end photo fades in on is read by its test id.
const endFadeOpacity = () => getAnimatedStyle(screen.getByTestId("form-media-end-fade")).opacity;

async function renderCard(props: FormMediaCardProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <FormMediaCard {...props} />
    </ThemeProvider>,
  );
}

describe("FormMediaCard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    openURLMock.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    openURLMock.mockReset();
  });

  describe("the video", () => {
    it("should be one link named from the title and the channel", async () => {
      await renderCard(video);

      expect(
        screen.getByRole("link", { name: describeFormVideoLink(video.title, video.channel) }),
      ).toBeOnTheScreen();
    });

    it("should say the video opens in YouTube", async () => {
      await renderCard(video);

      expect(screen.getByText(EXERCISE_FORM.opensInYouTube)).toBeOnTheScreen();
    });

    it("should open the watch address once when pressed", async () => {
      await renderCard(video);

      const user = userEvent.setup();
      await user.press(screen.getByRole("link", { name: /Watch/ }));

      expect(openURLMock).toHaveBeenCalledTimes(1);
      expect(openURLMock).toHaveBeenCalledWith(video.watchUrl);
    });

    it("should swallow a rejected open, as a device with no browser rejects", async () => {
      openURLMock.mockRejectedValue(new Error("No browser"));
      await renderCard(video);

      const user = userEvent.setup();
      await user.press(screen.getByRole("link", { name: /Watch/ }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(openURLMock).toHaveBeenCalledTimes(1);
    });

    it("should show the placeholder tile when the thumbnail does not load", async () => {
      await renderCard(video);
      expect(screen.queryByRole("img", { name: EXERCISE_FORM.imageFailedName })).toBeNull();

      await fireEvent(screen.getByRole("img", { name: video.title }), "error");

      expect(screen.getByRole("img", { name: EXERCISE_FORM.imageFailedName })).toBeOnTheScreen();
    });
  });

  describe("the photos", () => {
    it("should name each photo for the exercise and its position", async () => {
      await renderCard(photos);

      expect(screen.getByRole("img", { name: startName })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: endName })).toBeOnTheScreen();
    });

    it("should show the end photo only after the start photo has had its turn", async () => {
      await renderCard(photos);
      expect(endFadeOpacity()).toBe(0);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1600);
      });

      expect(endFadeOpacity()).toBe(1);
    });

    it("should loop back to the start photo and fade the end photo in again", async () => {
      await renderCard(photos);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1600);
      });
      expect(endFadeOpacity()).toBe(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1500);
      });
      expect(endFadeOpacity()).toBe(0);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1500);
      });
      expect(endFadeOpacity()).toBe(1);
    });

    it("should show both photos side by side, still, with Reduce Motion on", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      await renderCard(photos);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10);
      });

      expect(screen.getByText(EXERCISE_FORM.startLabel)).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_FORM.endLabel)).toBeOnTheScreen();
      expect(screen.queryByTestId("form-media-end-fade")).toBeNull();
      expect(screen.getByRole("img", { name: endName })).toBeVisible();
    });

    it("should leave no pending timers once it unmounts", async () => {
      await renderCard(photos);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1600);
      });

      await screen.unmount();
      // The loop would keep scheduling its next frame, so a few of its turns on, nothing is left to run.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5 * 3000);
      });

      expect(jest.getTimerCount()).toBe(0);
    });

    it("should show the placeholder tile when a photo does not load", async () => {
      await renderCard(photos);

      await fireEvent(screen.getByRole("img", { name: startName }), "error");

      expect(screen.getByRole("img", { name: EXERCISE_FORM.imageFailedName })).toBeOnTheScreen();
    });
  });

  describe("both", () => {
    const both = {
      kind: "both",
      title: video.title,
      channel: video.channel,
      thumbnailUrl: video.thumbnailUrl,
      watchUrl: video.watchUrl,
      exerciseName: photos.exerciseName,
      startUrl: photos.startUrl,
      endUrl: photos.endUrl,
    } as const;

    it("should show the video link and the start photo together", async () => {
      await renderCard(both);

      expect(
        screen.getByRole("link", { name: describeFormVideoLink(video.title, video.channel) }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: startName })).toBeOnTheScreen();
    });

    it("should open the video when the link is pressed", async () => {
      await renderCard(both);

      const user = userEvent.setup();
      await user.press(
        screen.getByRole("link", { name: describeFormVideoLink(video.title, video.channel) }),
      );

      expect(openURLMock).toHaveBeenCalledWith(video.watchUrl);
    });

    it("should show both photos side by side with Reduce Motion on", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      await renderCard(both);
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByRole("img", { name: startName })).toBeVisible();
      expect(screen.getByRole("img", { name: endName })).toBeVisible();
      expect(screen.getByRole("link")).toBeOnTheScreen();
    });
  });

  describe("the switch", () => {
    const withSwitch = (onChange: jest.Mock, value: "video" | "photos" | "both" = "both") =>
      ({
        ...video,
        preferenceSwitch: { value, onChange },
      }) as const;

    it("should be a radio group of Video, Photos and Both with the chosen one checked", async () => {
      await renderCard(withSwitch(jest.fn(), "photos"));

      expect(screen.getByLabelText(FORM_MEDIA_SWITCH.label)).toBeOnTheScreen();
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(screen.getByRole("radio", { name: "Photos" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Video" })).not.toBeChecked();
    });

    it("should call back with the option pressed", async () => {
      const onChange = jest.fn();
      await renderCard(withSwitch(onChange));

      const user = userEvent.setup();
      await user.press(screen.getByRole("radio", { name: "Video" }));

      expect(onChange).toHaveBeenCalledWith("video");
    });

    it("should be drawn under the photos card as well", async () => {
      await renderCard({ ...photos, preferenceSwitch: { value: "both", onChange: jest.fn() } });

      expect(screen.getByLabelText(FORM_MEDIA_SWITCH.label)).toBeOnTheScreen();
    });

    it("should not be drawn when the card has no switch", async () => {
      await renderCard(video);

      expect(screen.queryByLabelText(FORM_MEDIA_SWITCH.label)).not.toBeOnTheScreen();
    });
  });

  it("should say it is loading", async () => {
    await renderCard({ kind: "loading" });

    expect(screen.getByRole("status", { name: EXERCISE_FORM.loadingName })).toBeOnTheScreen();
  });

  it("should say the guide is unavailable in one line", async () => {
    await renderCard({ kind: "unavailable" });

    expect(screen.getByText(EXERCISE_FORM.unavailable)).toBeOnTheScreen();
  });
});
