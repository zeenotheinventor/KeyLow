import { createElement, useEffect } from "react";
import { Text } from "react-native";

import type { EffectCallback } from "expo-router";
import type { ReactNode } from "react";

const noSegments: string[] = [];
const noSearchParams: Record<string, string | string[]> = {};

export const routerMock = {
  push: jest.fn<undefined, [string]>(),
  replace: jest.fn<undefined, [string]>(),
  dismissTo: jest.fn<undefined, [string]>(),
  setParams: jest.fn<undefined, [Record<string, string | undefined>]>(),
  back: jest.fn<undefined, []>(),
  // Goes back in the navigator above the screen's own, which is how a screen closes the whole sheet it is in.
  parentGoBack: jest.fn<undefined, []>(),
  // Whether there is a navigator above the screen's own, and whether it has anything to go back to.
  hasParentNavigator: true,
  parentCanGoBack: jest.fn<boolean, []>(),
  canGoBack: jest.fn<boolean, []>(),
  // Whether the screen under test is the focused one. A test changes it, then rerenders.
  isFocused: true,
  redirect: jest.fn<undefined, [string]>(),
  segments: noSegments,
  searchParams: noSearchParams,
};

export function resetRouterMock(): void {
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  routerMock.dismissTo.mockReset();
  routerMock.setParams.mockReset();
  routerMock.back.mockReset();
  routerMock.parentGoBack.mockReset();
  routerMock.hasParentNavigator = true;
  routerMock.parentCanGoBack.mockReset();
  routerMock.parentCanGoBack.mockReturnValue(true);
  routerMock.canGoBack.mockReset();
  routerMock.canGoBack.mockReturnValue(true);
  routerMock.isFocused = true;
  routerMock.redirect.mockReset();
  routerMock.segments = [];
  routerMock.searchParams = {};
}

// The real useRouter returns one stable object, so effects that depend on it do not rerun.
const router = {
  replace: routerMock.replace,
  dismissTo: routerMock.dismissTo,
  setParams: routerMock.setParams,
  push: routerMock.push,
  back: routerMock.back,
  canGoBack: routerMock.canGoBack,
};

// The same object every render, like the real hook's, so an effect that depends on it does not rerun.
const navigation = {
  getParent: () =>
    routerMock.hasParentNavigator
      ? { goBack: routerMock.parentGoBack, canGoBack: routerMock.parentCanGoBack }
      : undefined,
};

function useIsFocused(): boolean {
  return routerMock.isFocused;
}

// Runs the effect while the screen is focused and its cleanup when focus goes, as the real hook does.
function useFocusEffect(effect: EffectCallback): void {
  const isFocused = routerMock.isFocused;
  useEffect(() => (isFocused ? effect() : undefined), [effect, isFocused]);
}

export const mockExpoRouter = {
  useRouter: () => router,
  useNavigation: () => navigation,
  useIsFocused,
  useFocusEffect,
  useSegments: () => routerMock.segments,
  useLocalSearchParams: () => routerMock.searchParams,
  // With `asChild` the link is its child, which is how the real one hands over its role and its press.
  Link: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) =>
    asChild === true ? children : createElement(Text, { accessibilityRole: "link" }, children),
  Redirect: ({ href }: { href: string }) => {
    routerMock.redirect(href);
    return null;
  },
};
