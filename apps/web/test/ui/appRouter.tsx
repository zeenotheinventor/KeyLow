import { render } from "@testing-library/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import { vi } from "vitest";

import type { NextRouter } from "next/router";
import type { ReactElement } from "react";

/**
 * Renders under a router, as in the browser. A `next/link` click then goes to `push` and the click
 * is cancelled, instead of loading a document, which is what the kit's link tests look for. Under
 * vitest `next/link` is the version that reads the pages router's context.
 */
export function renderWithRouter(ui: ReactElement) {
  const push = vi.fn<(href: string) => Promise<boolean>>().mockResolvedValue(true);
  // `next/link` only calls push, replace and prefetch, so the rest of the router is left out.
  const router = {
    push,
    replace: vi.fn().mockResolvedValue(true),
    prefetch: vi.fn().mockResolvedValue(undefined),
  } as unknown as NextRouter;

  render(<RouterContext.Provider value={router}>{ui}</RouterContext.Provider>);

  return { push };
}
