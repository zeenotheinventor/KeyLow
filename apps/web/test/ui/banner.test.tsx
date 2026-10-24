import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Mail } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "./appRouter";

import { Banner } from "@/components/ui/Banner";

const lightTextRule = "light-theme:text-text-primary";

// Whole class names, so "p-3" is not found inside "gap-3" and "text-body" not inside "text-body-strong".
const classesOf = (element: HTMLElement) => element.className.split(" ");

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

  describe("info look, as the boards draw it", () => {
    it("should pad 12 on every side", () => {
      render(<Banner tone="info">Check your email</Banner>);

      const classes = classesOf(screen.getByRole("status"));

      expect(classes).toContain("p-3");
      expect(classes).not.toContain("px-4");
    });

    it("should set the sentence under a title in body size, in the secondary ink", () => {
      render(
        <Banner tone="info" title="No target set">
          Set a calorie and macro target to see what is left.
        </Banner>,
      );

      const classes = classesOf(
        screen.getByText("Set a calorie and macro target to see what is left."),
      );

      expect(classes).toContain("text-body");
      expect(classes).toContain("text-text-secondary");
      expect(classes).not.toContain("text-caption");
    });

    it("should draw the action in body-strong accent ink, underlined", () => {
      render(
        <Banner tone="info" title="No target set" action={{ label: "Set target", href: "/more" }}>
          Set a calorie and macro target to see what is left.
        </Banner>,
      );

      const classes = classesOf(screen.getByRole("link", { name: "Set target" }));

      expect(classes).toContain("text-body-strong");
      expect(classes).toContain("text-accent-ink");
      expect(classes).toContain("underline");
    });

    it("should draw a button action the same way", () => {
      render(
        <Banner tone="info" action={{ label: "Update to current food data", onClick: vi.fn() }}>
          Your entry keeps the values you saved.
        </Banner>,
      );

      const classes = classesOf(
        screen.getByRole("button", { name: "Update to current food data" }),
      );

      expect(classes).toContain("text-body-strong");
      expect(classes).toContain("text-accent-ink");
      expect(classes).toContain("underline");
    });

    it("should put the action under the words by default", () => {
      render(
        <Banner tone="info" title="No target set" action={{ label: "Set target", href: "/more" }}>
          Set a target.
        </Banner>,
      );

      const words = screen.getByText("Set a target.").parentElement;

      expect(words?.contains(screen.getByRole("link", { name: "Set target" }))).toBe(true);
    });

    it("should still put the action at the end of the row when asked", () => {
      render(
        <Banner
          tone="info"
          title="No target set"
          action={{ label: "Set target", href: "/more" }}
          actionPlacement="trailing"
        >
          Set a target.
        </Banner>,
      );

      const words = screen.getByText("Set a target.").parentElement;

      expect(words?.contains(screen.getByRole("link", { name: "Set target" }))).toBe(false);
    });
  });

  describe("review and error look, unchanged", () => {
    it.each(["review", "error"] as const)(
      "should keep %s padding at 16 across and 12 down",
      (tone) => {
        render(<Banner tone={tone}>Energy is not given.</Banner>);

        const classes = classesOf(screen.getByRole(tone === "review" ? "note" : "alert"));

        expect(classes).toContain("px-4");
        expect(classes).toContain("py-3");
        expect(classes).not.toContain("p-3");
      },
    );

    it.each(["review", "error"] as const)("should keep the %s sentence in caption size", (tone) => {
      render(
        <Banner tone={tone} title="A title">
          The sentence.
        </Banner>,
      );

      const classes = classesOf(screen.getByText("The sentence."));

      expect(classes).toContain("text-caption");
      expect(classes).toContain("text-text-secondary");
    });

    it.each(["review", "error"] as const)(
      "should keep the %s action 14 pixels semibold, trailing and not underlined",
      (tone) => {
        render(
          <Banner tone={tone} action={{ label: "Do it", onClick: vi.fn() }}>
            Energy is not given.
          </Banner>,
        );

        const classes = classesOf(screen.getByRole("button", { name: "Do it" }));

        expect(classes).toContain("text-[14px]");
        expect(classes).toContain("font-semibold");
        expect(classes).toContain("min-h-control-sm");
        expect(classes).not.toContain("underline");
        expect(classes).not.toContain("text-accent-ink");
        expect(classes).not.toContain("text-body-strong");
      },
    );

    it.each(["review", "error"] as const)(
      "should keep the %s action below as a primary ink underlined link",
      (tone) => {
        render(
          <Banner
            tone={tone}
            action={{ label: "Edit the food", href: "/foods/1/edit" }}
            actionPlacement="below"
          >
            Saved, but not its portions.
          </Banner>,
        );

        const classes = classesOf(screen.getByRole("link", { name: "Edit the food" }));

        expect(classes).toContain("text-[14px]");
        expect(classes).toContain("text-text-primary");
        expect(classes).toContain("underline");
        expect(classes).not.toContain("text-accent-ink");
      },
    );

    it("should default a review action to trailing", () => {
      render(
        <Banner tone="review" title="Needs review" action={{ label: "Copy", onClick: vi.fn() }}>
          Energy is not given.
        </Banner>,
      );

      const words = screen.getByText("Energy is not given.").parentElement;

      expect(words?.contains(screen.getByRole("button", { name: "Copy" }))).toBe(false);
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
