import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Mail } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "./appRouter";

import { Banner } from "@/components/ui/Banner";

const lightTextRule = "light-theme:text-text-primary";

describe("Banner", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show a message", () => {
    render(<Banner tone="error">Email or password is not right. Check them and try again.</Banner>);

    expect(
      screen.getByText("Email or password is not right. Check them and try again."),
    ).toBeTruthy();
  });

  it("should show a title above its body", () => {
    render(
      <Banner tone="info" title="Check your email">
        Open the confirmation link to finish creating your account.
      </Banner>,
    );

    expect(screen.getByText("Check your email")).toBeTruthy();
    expect(
      screen.getByText("Open the confirmation link to finish creating your account."),
    ).toBeTruthy();
  });

  describe("tone", () => {
    it("should announce an error as an alert", () => {
      render(<Banner tone="error">Your food could not be saved.</Banner>);

      expect(screen.getByRole("alert").textContent).toContain("Your food could not be saved.");
    });

    it("should announce info politely as a status", () => {
      render(<Banner tone="info">Check your email</Banner>);

      expect(screen.getByRole("status").textContent).toContain("Check your email");
    });

    it("should leave a review notice as a note, because it is on the page for good", () => {
      render(
        <Banner tone="review" title="Needs review">
          Energy is not given.
        </Banner>,
      );

      expect(screen.getByRole("note").textContent).toContain("Needs review");
    });

    it("should be info when no tone is given", () => {
      render(<Banner>Open Food Facts could not be searched right now</Banner>);

      expect(screen.getByRole("status")).toBeTruthy();
    });

    it("should let the screen choose the role", () => {
      render(
        <Banner tone="review" role="alert">
          Your food was saved, but its portions were not.
        </Banner>,
      );

      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  describe("icon", () => {
    it("should draw a decorative icon", () => {
      render(<Banner tone="error">Could not be saved</Banner>);

      expect(screen.getByRole("alert").querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    it("should draw the icon it is given", () => {
      const { rerender } = render(<Banner tone="info">Check your email</Banner>);
      const standard = screen.getByRole("status").querySelector("svg")?.innerHTML;

      rerender(
        <Banner tone="info" icon={Mail}>
          Check your email
        </Banner>,
      );

      expect(screen.getByRole("status").querySelector("svg")?.innerHTML).not.toBe(standard);
    });
  });

  describe("action", () => {
    it("should be a button that reports a click", () => {
      const onClick = vi.fn();
      render(
        <Banner
          tone="review"
          title="Needs review"
          action={{ label: "Copy to your foods", onClick }}
        >
          Energy is not given.
        </Banner>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy to your foods" }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should be a link when it goes to a page", () => {
      render(
        <Banner tone="review" action={{ label: "Edit the food", href: "/foods/1/edit" }}>
          Your food was saved, but its portions were not.
        </Banner>,
      );

      expect(screen.getByRole("link", { name: "Edit the food" }).getAttribute("href")).toBe(
        "/foods/1/edit",
      );
    });

    it("should open the page through the router, so the app is not loaded again", () => {
      const { push } = renderWithRouter(
        <Banner tone="review" action={{ label: "Edit the food", href: "/foods/1/edit" }}>
          Your food was saved, but its portions were not.
        </Banner>,
      );

      const notCancelled = fireEvent.click(screen.getByRole("link", { name: "Edit the food" }));

      expect(notCancelled).toBe(false);
      expect(push).toHaveBeenCalledExactlyOnceWith("/foods/1/edit", expect.anything());
    });

    it("should have no action unless given one", () => {
      render(<Banner tone="review">Energy is not given.</Banner>);

      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("light mode", () => {
    it("should keep the review title in the primary text colour", () => {
      render(
        <Banner tone="review" title="Needs review">
          Energy is not given.
        </Banner>,
      );

      expect(screen.getByText("Needs review").className).toContain(lightTextRule);
    });

    it("should keep a trailing review action in the primary text colour", () => {
      render(
        <Banner tone="review" action={{ label: "Copy to your foods", onClick: () => undefined }}>
          Energy is not given.
        </Banner>,
      );

      expect(screen.getByRole("button").className).toContain(lightTextRule);
    });

    it("should not colour the text of an error", () => {
      render(
        <Banner tone="error" title="Could not be added">
          Check your connection.
        </Banner>,
      );

      expect(screen.getByText("Could not be added").className).not.toContain("text-danger");
    });
  });
});
