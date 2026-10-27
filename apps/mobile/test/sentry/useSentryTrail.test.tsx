import { addBreadcrumb } from "@sentry/react-native";
import { act, renderHook } from "@testing-library/react-native";
import { AppState, Keyboard } from "react-native";

import { useSentryTrail } from "../../lib/sentry/useSentryTrail";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { subscription } from "../support/keyboardStub";

import type { AppStateStatus } from "react-native";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);

type KeyboardListener = Parameters<typeof Keyboard.addListener>[1];

// Stands in for the app state and the keyboard, so a test announces what they would.
function stubAnnouncements() {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const keyboardListeners = new Map<string, KeyboardListener>();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    appStateListener = handler;
    return subscription(() => undefined);
  });
  jest.spyOn(Keyboard, "addListener").mockImplementation((eventName, listener) => {
    keyboardListeners.set(eventName, listener);
    return subscription(() => undefined);
  });
  return {
    appStateBecomes: (state: AppStateStatus) =>
      act(() => {
        appStateListener?.(state);
      }),
    keyboardAnnounces: (eventName: string, screenY: number, height: number) =>
      act(() => {
        keyboardListeners.get(eventName)?.({
          duration: 0,
          easing: "keyboard",
          endCoordinates: { screenX: 0, screenY, width: 390, height },
        });
      }),
  };
}

describe("useSentryTrail", () => {
  beforeEach(() => {
    resetRouterMock();
    jest.mocked(addBreadcrumb).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should note the screen the person is on, as a route with its parameters unfilled", async () => {
    routerMock.segments = ["recipes", "[id]", "edit"];
    stubAnnouncements();

    await renderHook(() => {
      useSentryTrail();
    });

    const navigations = jest
      .mocked(addBreadcrumb)
      .mock.calls.filter(([breadcrumb]) => breadcrumb.category === "navigation");
    const destinations = navigations.map(([breadcrumb]): unknown => breadcrumb.data?.to);
    expect(destinations).toEqual(["/recipes/[id]/edit"]);
  });

  it("should note each time the app comes forward or goes away", async () => {
    const announcements = stubAnnouncements();
    await renderHook(() => {
      useSentryTrail();
    });

    await announcements.appStateBecomes("background");
    await announcements.appStateBecomes("active");

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "app.state",
      data: { state: "background" },
    });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "app.state",
      data: { state: "active" },
    });
  });

  it("should note the keyboard coming and going, with the edges it announced", async () => {
    const announcements = stubAnnouncements();
    await renderHook(() => {
      useSentryTrail();
    });

    await announcements.keyboardAnnounces("keyboardDidShow", 560, 300);
    await announcements.keyboardAnnounces("keyboardDidHide", 860, 0);

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "keyboard",
      data: { event: "show", screenY: 560, height: 300 },
    });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "keyboard",
      data: { event: "hide", screenY: 860, height: 0 },
    });
  });
});
