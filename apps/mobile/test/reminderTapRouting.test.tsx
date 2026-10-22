import { act, renderHook } from "@testing-library/react-native";

import {
  leaveTapFromColdStart,
  notificationsState,
  resetNotificationsMock,
  tapNotification,
} from "./support/expoNotificationsMock";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { useReminderTapRouting } from "../lib/reminderScheduler/useReminderTapRouting";

jest.mock(
  "expo-notifications",
  () =>
    jest.requireActual<typeof import("./support/expoNotificationsMock")>(
      "./support/expoNotificationsMock",
    ).mockExpoNotifications,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

const SIGNED_IN = ["(tabs)", "dashboard"];

const identifierOf = (type: string) => `keylow-reminder:${type}:1790000000000`;
const goneTo = () => [...routerMock.navigate.mock.calls, ...routerMock.push.mock.calls];

describe("tapping a reminder", () => {
  beforeEach(() => {
    resetRouterMock();
    resetNotificationsMock();
    routerMock.segments = SIGNED_IN;
  });

  describe("while the app is running", () => {
    it("should open the Train tab for Time to train", async () => {
      await renderHook(() => {
        useReminderTapRouting();
      });

      await act(() => {
        tapNotification(identifierOf("train"), { type: "train" });
      });

      expect(routerMock.navigate).toHaveBeenCalledWith("/train");
      expect(goneTo()).toHaveLength(1);
    });

    it("should open the Routines page, where the Progress section is, for See your progress", async () => {
      await renderHook(() => {
        useReminderTapRouting();
      });

      await act(() => {
        tapNotification(identifierOf("progress"), { type: "progress" });
      });

      expect(routerMock.push).toHaveBeenCalledWith("/train/routines");
      expect(goneTo()).toHaveLength(1);
    });

    it("should open the body map for Take it easy", async () => {
      await renderHook(() => {
        useReminderTapRouting();
      });

      await act(() => {
        tapNotification(identifierOf("ease"), { type: "ease" });
      });

      expect(routerMock.push).toHaveBeenCalledWith("/body-map");
      expect(goneTo()).toHaveLength(1);
    });

    it("should ignore a notification that is not one of ours", async () => {
      await renderHook(() => {
        useReminderTapRouting();
      });

      await act(() => {
        tapNotification("somebody-else", { type: "train" });
      });

      expect(goneTo()).toEqual([]);
    });

    it("should stop listening when it unmounts", async () => {
      const { unmount } = await renderHook(() => {
        useReminderTapRouting();
      });

      await unmount();

      expect(notificationsState.listeners.size).toBe(0);
    });
  });

  describe("when the tap opened the app", () => {
    it.each([
      ["train", "/train", "navigate"],
      ["progress", "/train/routines", "push"],
      ["ease", "/body-map", "push"],
    ] as const)("should go to the screen of a %s reminder", async (type, path, how) => {
      leaveTapFromColdStart(identifierOf(type), { type });

      await renderHook(() => {
        useReminderTapRouting();
      });

      expect(routerMock[how]).toHaveBeenCalledWith(path);
      expect(goneTo()).toHaveLength(1);
    });

    it("should not go again when it mounts a second time", async () => {
      leaveTapFromColdStart(identifierOf("train"), { type: "train" });
      const first = await renderHook(() => {
        useReminderTapRouting();
      });
      await first.unmount();
      routerMock.navigate.mockClear();

      await renderHook(() => {
        useReminderTapRouting();
      });

      expect(goneTo()).toEqual([]);
    });
  });

  describe("before the person is in the app", () => {
    it.each([[[]], [["(auth)", "sign-in"]], [["auth", "callback"]]])(
      "should wait on %j and follow the tap once they are",
      async (segments) => {
        routerMock.segments = segments;
        leaveTapFromColdStart(identifierOf("progress"), { type: "progress" });
        const { rerender } = await renderHook(() => {
          useReminderTapRouting();
        });
        expect(goneTo()).toEqual([]);

        routerMock.segments = SIGNED_IN;
        await rerender(undefined);

        expect(routerMock.push).toHaveBeenCalledTimes(1);
        expect(routerMock.push).toHaveBeenCalledWith("/train/routines");
      },
    );
  });
});
