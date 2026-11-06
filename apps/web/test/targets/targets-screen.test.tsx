import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";
import { renderWithRouter } from "../ui/appRouter";

import type { Targets, TargetsRow } from "@keylow/api-client";

import TargetsPage from "@/app/(dashboard)/more/targets/page";

type TargetsQuery = {
  data: Targets | undefined;
  isError: boolean;
  // A read that waits for a connection is "paused", and stays pending, so a screen must not wait on it for ever.
  fetchStatus?: "fetching" | "paused" | "idle";
  refetch: () => Promise<unknown>;
};

type ProgramSummaryQuery = {
  data: { currentTargets: Pick<TargetsRow, "effectiveFrom"> | null } | undefined;
  isError: boolean;
  fetchStatus?: "fetching" | "paused" | "idle";
};

const { useTargets, useProgramSummary, mutateAsync, refetch } = vi.hoisted(() => ({
  useTargets: vi.fn<() => TargetsQuery>(),
  useProgramSummary: vi.fn<(options?: { enabled?: boolean }) => ProgramSummaryQuery>(),
  mutateAsync: vi.fn<(targets: unknown) => Promise<unknown>>(),
  refetch: vi.fn<() => Promise<unknown>>(),
}));

// The golden week, set on Friday 23 October by the programme.
const GOLDEN_PROGRAMME: Targets = {
  kcal: 2140,
  protein_g: 126,
  carbs_g: 245,
  fat_g: 73,
  source: "engine",
  dowCaloriesKcal: [2140, 2140, 2140, 2140, 2140, 2140, 2140],
};

const SUMMARY_WITH_SINCE: ProgramSummaryQuery = {
  data: { currentTargets: { effectiveFrom: "2026-10-23" } },
  isError: false,
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useTargets,
  useProgramSummary,
  useUpdateTargets: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/components/ui/Toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/Toast")>()),
  useToast: () => ({ show: vi.fn() }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  onlineManager.setOnline(true);
  useProgramSummary.mockReturnValue({ data: undefined, isError: false });
  useTargets.mockReturnValue({
    data: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, source: "manual" },
    isError: false,
    refetch,
  });
});

afterEach(() => {
  cleanup();
});

describe("the Targets page", () => {
  it("should be headed Targets, under a More / Targets breadcrumb that goes back to More", () => {
    render(<TargetsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Targets" })).toBeTruthy();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb.textContent).toBe("More / Targets");
    expect(screen.getByRole("link", { name: "More" }).getAttribute("href")).toBe("/more");
  });

  it("should show the form once the stored targets are known", () => {
    render(<TargetsPage />);

    expect(screen.getByRole("textbox", { name: /^Calories/ })).toHaveProperty("value", "2200");
  });

  it("should wait for the stored targets with a loading state and no form", () => {
    useTargets.mockReturnValue({ data: undefined, isError: false, refetch });
    render(<TargetsPage />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("should say it could not load and offer to try again", () => {
    useTargets.mockReturnValue({ data: undefined, isError: true, refetch });
    render(<TargetsPage />);

    expect(screen.getByRole("heading", { name: "Something went wrong. Try again." })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("should pad top and bottom as the web targets boards draw it", async () => {
    const { container } = render(<TargetsPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [16, 16],
      desktop: [32, 32],
    });
  });
});

describe("the Targets page while a programme runs", () => {
  beforeEach(() => {
    useTargets.mockReturnValue({ data: GOLDEN_PROGRAMME, isError: false, refetch });
    useProgramSummary.mockReturnValue(SUMMARY_WITH_SINCE);
  });

  it("should show the golden figures read only, with the date they began from the current targets row", () => {
    renderWithRouter(<TargetsPage />);

    const figures = screen.getByRole("region", { name: "This week's targets" });
    expect(
      within(figures)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["Calories2,140kcal", "Protein126g", "Carbohydrate245g", "Fat73g"]);
    expect(screen.getByText("Since Friday 23 October")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("should link to the Programme page and keep the breadcrumb back to More", () => {
    renderWithRouter(<TargetsPage />);

    expect(screen.getByRole("link", { name: /^Programme/ }).getAttribute("href")).toBe(
      "/more/program",
    );
    expect(screen.getByRole("link", { name: "More" }).getAttribute("href")).toBe("/more");
  });

  it("should read the programme only for a person whose programme runs", () => {
    renderWithRouter(<TargetsPage />);

    expect(useProgramSummary).toHaveBeenCalledWith({ enabled: true });
  });

  it("should show the figures without the date while the programme read is loading", () => {
    useProgramSummary.mockReturnValue({ data: undefined, isError: false });
    renderWithRouter(<TargetsPage />);

    expect(screen.getByText("2,140")).toBeTruthy();
    expect(screen.queryByText(/^Since /)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("should show the figures without the date, and never the form, when the programme read failed", () => {
    useProgramSummary.mockReturnValue({ data: undefined, isError: true });
    renderWithRouter(<TargetsPage />);

    expect(screen.getByText("2,140")).toBeTruthy();
    expect(screen.queryByText(/^Since /)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("should show the figures without the date when the programme read is waiting for a connection", () => {
    useProgramSummary.mockReturnValue({ data: undefined, isError: false, fetchStatus: "paused" });
    renderWithRouter(<TargetsPage />);

    expect(screen.getByText("2,140")).toBeTruthy();
    expect(screen.queryByText(/^Since /)).toBeNull();
  });

  describe("Set my own targets", () => {
    it("should open the form that is shown for manual targets, with the note that saving ends the programme", () => {
      renderWithRouter(<TargetsPage />);

      fireEvent.click(screen.getByRole("button", { name: "Set my own targets" }));

      expect(screen.getByRole("textbox", { name: /^Calories/ })).toHaveProperty("value", "2140");
      expect(
        screen.getByText("Saving your own targets ends your programme and its weekly check-in."),
      ).toBeTruthy();
      expect(screen.queryByRole("region", { name: "This week's targets" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Set my own targets" })).toBeNull();
    });

    it("should move focus to the page heading when the button goes, so it is not lost to the body", () => {
      renderWithRouter(<TargetsPage />);
      const button = screen.getByRole("button", { name: "Set my own targets" });
      button.focus();

      fireEvent.click(button);

      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
      expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
    });

    it("should still ask before it saves, and save nothing until Save my targets", () => {
      mutateAsync.mockResolvedValue(undefined);
      renderWithRouter(<TargetsPage />);
      fireEvent.click(screen.getByRole("button", { name: "Set my own targets" }));

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(screen.getByRole("dialog", { name: "Turn off weekly check-ins?" })).toBeTruthy();
      expect(mutateAsync).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Save my targets" }));

      expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({
        kcal: 2140,
        protein_g: 126,
        carbs_g: 245,
        fat_g: 73,
      });
    });

    it("should keep the programme, and save nothing, when the question is answered Keep my programme", () => {
      renderWithRouter(<TargetsPage />);
      fireEvent.click(screen.getByRole("button", { name: "Set my own targets" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      fireEvent.click(screen.getByRole("button", { name: "Keep my programme" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("should leave the page through Cancel, to More, so no half-state is left behind", () => {
      renderWithRouter(<TargetsPage />);
      fireEvent.click(screen.getByRole("button", { name: "Set my own targets" }));

      expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/more");

      // Coming back to the page is a new visit, which reads the programme again and starts read only.
      cleanup();
      renderWithRouter(<TargetsPage />);

      expect(screen.getByRole("button", { name: "Set my own targets" })).toBeTruthy();
      expect(screen.queryByRole("textbox")).toBeNull();
    });
  });

  describe("without a connection", () => {
    it("should keep the figures read this session and turn Set my own targets off", () => {
      onlineManager.setOnline(false);
      renderWithRouter(<TargetsPage />);

      expect(screen.getByText("2,140")).toBeTruthy();
      expect(screen.getByText("Since Friday 23 October")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Set my own targets" })).toHaveProperty(
        "disabled",
        true,
      );
    });

    it("should turn Set my own targets back on when the connection returns", () => {
      onlineManager.setOnline(false);
      renderWithRouter(<TargetsPage />);

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.getByRole("button", { name: "Set my own targets" })).toHaveProperty(
        "disabled",
        false,
      );
    });
  });
});

describe("the Targets page when a read fails", () => {
  it("should show the error when the read fails with nothing held", () => {
    useTargets.mockReturnValue({ data: undefined, isError: true, fetchStatus: "idle", refetch });
    render(<TargetsPage />);

    expect(screen.getByRole("heading", { name: "Something went wrong. Try again." })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("should keep the figures when a refresh fails while a programme's targets are held", () => {
    useTargets.mockReturnValue({
      data: GOLDEN_PROGRAMME,
      isError: true,
      fetchStatus: "idle",
      refetch,
    });
    renderWithRouter(<TargetsPage />);

    expect(screen.getByText("2,140")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Set my own targets" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Something went wrong. Try again." })).toBeNull();
  });

  it("should keep what is typed in the form when a refresh fails while the targets are held", () => {
    const { rerender } = render(<TargetsPage />);
    fireEvent.change(screen.getByRole("textbox", { name: /^Calories/ }), {
      target: { value: "2500" },
    });

    useTargets.mockReturnValue({
      data: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, source: "manual" },
      isError: true,
      fetchStatus: "idle",
      refetch,
    });
    rerender(<TargetsPage />);

    expect(screen.getByRole("textbox", { name: /^Calories/ })).toHaveProperty("value", "2500");
    expect(screen.queryByRole("heading", { name: "Something went wrong. Try again." })).toBeNull();
  });
});

describe("the Targets page before it knows whether a programme runs", () => {
  it("should draw no form and no Set my own targets while the targets load", () => {
    useTargets.mockReturnValue({
      data: undefined,
      isError: false,
      fetchStatus: "fetching",
      refetch,
    });
    render(<TargetsPage />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Set my own targets" })).toBeNull();
  });

  it("should draw no form when the targets could not be read", () => {
    useTargets.mockReturnValue({ data: undefined, isError: true, fetchStatus: "idle", refetch });
    render(<TargetsPage />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("should not offer Try again without a connection after a failed read, which would only wait", () => {
    onlineManager.setOnline(false);
    useTargets.mockReturnValue({ data: undefined, isError: true, fetchStatus: "idle", refetch });
    render(<TargetsPage />);

    expect(screen.getByRole("heading", { name: "Something went wrong. Try again." })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("should not wait for ever for a read that is waiting for a connection", () => {
    useTargets.mockReturnValue({ data: undefined, isError: false, fetchStatus: "paused", refetch });
    render(<TargetsPage />);

    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Something went wrong. Try again." })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("should not wait for ever when opened with no connection, before any read has paused", () => {
    onlineManager.setOnline(false);
    useTargets.mockReturnValue({
      data: undefined,
      isError: false,
      fetchStatus: "fetching",
      refetch,
    });
    render(<TargetsPage />);

    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Something went wrong. Try again." })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("the Targets page with manual targets", () => {
  it("should show the form once the targets are read, with a Save and no Set my own targets", () => {
    render(<TargetsPage />);

    expect(screen.getByRole("textbox", { name: /^Calories/ })).toHaveProperty("value", "2200");
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Set my own targets" })).toBeNull();
  });

  it("should leave the heading out of the tab order and not move focus on arrival", () => {
    render(<TargetsPage />);

    expect(screen.getByRole("heading", { level: 1 }).hasAttribute("tabindex")).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it("should not read the programme, which only a running one has anything to show for", () => {
    render(<TargetsPage />);

    expect(useProgramSummary).toHaveBeenCalledWith({ enabled: false });
  });

  it("should keep the form while offline, with the Save it always had", () => {
    onlineManager.setOnline(false);
    render(<TargetsPage />);

    expect(screen.getByRole("textbox", { name: /^Calories/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Set my own targets" })).toBeNull();
  });
});
