import { createElement } from "react";
import { Text } from "react-native";

import type { ReactNode } from "react";

const noSegments: string[] = [];
const noSearchParams: Record<string, string | string[]> = {};

export const routerMock = {
  push: jest.fn<undefined, [string]>(),
  replace: jest.fn<undefined, [string]>(),
  redirect: jest.fn<undefined, [string]>(),
  segments: noSegments,
  searchParams: noSearchParams,
};

export function resetRouterMock(): void {
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  routerMock.redirect.mockReset();
  routerMock.segments = [];
  routerMock.searchParams = {};
}

export const mockExpoRouter = {
  useRouter: () => ({ push: routerMock.push, replace: routerMock.replace }),
  useSegments: () => routerMock.segments,
  useLocalSearchParams: () => routerMock.searchParams,
  Link: ({ children }: { children: ReactNode }) =>
    createElement(Text, { accessibilityRole: "link" }, children),
  Redirect: ({ href }: { href: string }) => {
    routerMock.redirect(href);
    return null;
  },
};
