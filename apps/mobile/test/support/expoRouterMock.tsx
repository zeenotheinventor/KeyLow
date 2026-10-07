import { createElement, useEffect } from "react";
import { Text } from "react-native";

import type { EffectCallback } from "expo-router";
import type { ReactNode } from "react";

const noSegments: string[] = [];
const noSearchParams: Record<string, string | string[]> = {};

export const routerMock = {
  push: jest.fn<undefined, [string]>(),
  replace: jest.fn<undefined, [string]>(),
  back: jest.fn<undefined, []>(),
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
  routerMock.back.mockReset();
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
  push: routerMock.push,
  back: routerMock.back,
  canGoBack: routerMock.canGoBack,
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
  useIsFocused,
  useFocusEffect,
  useSegments: () => routerMock.segments,
  useLocalSearchParams: () => routerMock.searchParams,
  Link: ({ children }: { children: ReactNode }) =>
    createElement(Text, { accessibilityRole: "link" }, children),
  Redirect: ({ href }: { href: string }) => {
    routerMock.redirect(href);
    return null;
  },
};
