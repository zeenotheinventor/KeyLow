import { GENERIC_ERROR } from "@keylow/core/copy";
import { captureException } from "@sentry/nextjs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardError from "@/app/(dashboard)/error";
import RouteError from "@/app/error";
import GlobalError from "@/app/global-error";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const failure = new Error("Could not log the food: Chicken breast at 82.4 kg");

describe("the error pages", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(captureException).mockClear();
  });

  describe("app/error", () => {
    it("should tell the user something went wrong in the generic words, not the failure's", () => {
      render(<RouteError error={failure} reset={vi.fn()} />);

      expect(screen.getByRole("alert").textContent).toContain(GENERIC_ERROR);
      expect(screen.getByRole("alert").textContent).not.toContain("Chicken breast");
    });

    it("should report the failure to Sentry once", () => {
      render(<RouteError error={failure} reset={vi.fn()} />);

      expect(captureException).toHaveBeenCalledExactlyOnceWith(failure);
    });

    it("should try the page again when the user asks", () => {
      const reset = vi.fn();
      render(<RouteError error={failure} reset={reset} />);

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(reset).toHaveBeenCalledOnce();
    });
  });

  describe("app/(dashboard)/error", () => {
    it("should report the failure and offer a retry, inside the dashboard layout", () => {
      const reset = vi.fn();
      render(<DashboardError error={failure} reset={reset} />);

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(captureException).toHaveBeenCalledExactlyOnceWith(failure);
      expect(reset).toHaveBeenCalledOnce();
    });
  });

  describe("app/global-error", () => {
    it("should render its own page around the same message and a retry", () => {
      const reset = vi.fn();
      const markup = renderToStaticMarkup(<GlobalError error={failure} reset={reset} />);
      const page = new DOMParser().parseFromString(markup, "text/html");

      expect(page.documentElement.lang).toBe("en");
      expect(page.body.textContent).toContain(GENERIC_ERROR);
      // The parsed page has no window of its own, which role queries need, so its body goes into the test's document.
      document.body.innerHTML = page.body.innerHTML;
      expect(within(document.body).getByRole("button", { name: "Try again" })).toBeDefined();
    });

    it("should report the failure to Sentry", () => {
      render(<GlobalError error={failure} reset={vi.fn()} />);

      expect(captureException).toHaveBeenCalledExactlyOnceWith(failure);
    });
  });
});
