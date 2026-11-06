import { keys } from "@keylow/api-client";
import {
  PROGRAM_EDIT,
  PROGRAM_EDIT_FAILED_BANNER,
  TARGETS_SAVED_TOAST,
  describeProteinGrams,
  describeRateAmount,
} from "@keylow/core/copy";
import { computeTrend } from "@keylow/core/engine";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  editBackend,
  releaseHeldReads,
  renderWithEditBackend,
  resetEditBackend,
  signInEditClient,
  targetsRow,
  weighInRow,
} from "./programEditBackend";

import { ProgramEditScreen } from "@/components/program";
import { ToastProvider } from "@/components/ui/Toast";

const { push, replace } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

function renderScreen() {
  return renderWithEditBackend(
    <ToastProvider>
      <ProgramEditScreen />
    </ToastProvider>,
  );
}

async function renderForm() {
  const rendered = renderScreen();
  await screen.findByRole("radiogroup", { name: "Goal" });
  return rendered;
}

const radio = (name: RegExp) => screen.getByRole("radio", { name });
const saveButton = () => screen.getByRole("button", { name: PROGRAM_EDIT.saveLabel });
const backLink = () => screen.getByRole("link", { name: PROGRAM_EDIT.backName });
const writes = () => editBackend.calls.filter((call) => call.kind === "write");

beforeEach(async () => {
  await signInEditClient();
  resetEditBackend();
  push.mockReset();
  replace.mockReset();
  onlineManager.setOnline(true);
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("Edit programme", () => {
  describe("the form", () => {
    it("should draw the four groups, the footnote and Save changes under the back link and title", async () => {
      await renderForm();

      expect(screen.getByRole("heading", { level: 1, name: PROGRAM_EDIT.title })).toBeTruthy();
      expect(backLink().getAttribute("href")).toBe("/more/program");
      for (const group of ["Goal", "Rate", "Protein", "Diet style"]) {
        expect(screen.getByRole("radiogroup", { name: group })).toBeTruthy();
      }
      expect(
        await screen.findByText(
          "Saving changes your targets from today. Your expenditure estimate stays at 2,580 kcal a day.",
        ),
      ).toBeTruthy();
      expect(saveButton().hasAttribute("disabled")).toBe(false);
      expect(screen.queryByRole("button", { name: /cancel|close/i })).toBeNull();
    });

    it("should start from the stored programme", async () => {
      await renderForm();

      expect(radio(/^Lose weight/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/^0\.5% a week/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/^Moderate/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/^Balanced/).getAttribute("aria-checked")).toBe("true");
    });

    it("should ask for the rate for Lose and Gain only", async () => {
      await renderForm();

      fireEvent.click(radio(/^Maintain weight/));
      expect(screen.queryByRole("radiogroup", { name: "Rate" })).toBeNull();

      fireEvent.click(radio(/^Gain weight/));
      expect(screen.getByRole("radiogroup", { name: "Rate" })).toBeTruthy();
    });
  });

  describe("the weight the values are worked out at", () => {
    const rateAt = (weightKg: number) => describeRateAmount(0.5, weightKg, "kg");
    const proteinAt = (weightKg: number) => describeProteinGrams("moderate", weightKg);

    it("should be the trend weight, not the latest weigh-in", async () => {
      editBackend.weighIns = [weighInRow("2026-11-05", 90), weighInRow("2026-10-20", 70)];
      const trendKg = computeTrend([
        { localDate: "2026-10-20", weightKg: 70 },
        { localDate: "2026-11-05", weightKg: 90 },
      ]).at(-1)?.trendKg;
      if (trendKg === undefined) {
        throw new Error("The fixture should have a trend");
      }
      editBackend.targets = [targetsRow(75)];

      await renderForm();

      expect(proteinAt(trendKg)).not.toBe(proteinAt(90));
      expect(radio(/^Moderate/).textContent).toContain(proteinAt(trendKg));
      expect(radio(/^0\.5% a week/).textContent).toContain(rateAt(trendKg));
    });

    it("should be the latest weigh-in when the trend cannot be read", async () => {
      editBackend.weighIns = [weighInRow("2026-11-05", 90)];
      editBackend.failingWeighInList = true;
      editBackend.targets = [targetsRow(75)];

      await renderForm();

      expect(radio(/^Moderate/).textContent).toContain(proteinAt(90));
      expect(radio(/^0\.5% a week/).textContent).toContain(rateAt(90));
    });

    it("should be the weight the current targets were worked out at when there is no weigh-in", async () => {
      editBackend.weighIns = [];
      editBackend.targets = [targetsRow(75)];

      await renderForm();

      expect(radio(/^Moderate/).textContent).toContain(proteinAt(75));
      expect(radio(/^0\.5% a week/).textContent).toContain(rateAt(75));
    });
  });

  describe("under 18", () => {
    beforeEach(() => {
      editBackend.birthDate = `${new Date().getFullYear() - 15}-06-15`;
      editBackend.program = { ...editBackend.program, goal: "lose" };
    });

    it("should not offer Lose, choose Maintain, say why and ask for no rate", async () => {
      await renderForm();

      expect(radio(/^Lose weight/).hasAttribute("disabled")).toBe(true);
      expect(radio(/^Maintain weight/).getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText("Talk to a health professional")).toBeTruthy();
      expect(screen.queryByRole("radiogroup", { name: "Rate" })).toBeNull();
    });

    it("should save Maintain, which the rule allows", async () => {
      await renderForm();

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/more/program");
      });
      expect(writes()[0]?.body).toMatchObject({ goal: "maintain" });
    });
  });

  describe("saving", () => {
    it("should write the choices, recompute, and go back to Programme with the toast", async () => {
      await renderForm();
      fireEvent.click(radio(/^Gain weight/));
      fireEvent.click(radio(/^High/));
      fireEvent.click(radio(/^Low carb/));

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/more/program");
      });
      expect(editBackend.calls.map((call) => call.kind)).toEqual(["write", "recompute"]);
      expect(editBackend.calls[0]?.body).toMatchObject({
        goal: "gain",
        rate_pct_per_week: 0.25,
        protein_g_per_kg: 2,
        fat_fraction_of_remaining: 0.6,
        split_preset: "low_carb",
      });
      expect(editBackend.calls[1]?.body).toEqual({ mode: "recompute" });
      expect(await screen.findByText(TARGETS_SAVED_TOAST)).toBeTruthy();
    });

    it("should show the spinner and make the back link dimmed and inert while it runs", async () => {
      editBackend.holdingWrite = true;
      await renderForm();

      fireEvent.click(saveButton());

      const saving = await screen.findByRole("button", { name: "Saving" });
      expect(saving.hasAttribute("disabled")).toBe(true);
      expect(backLink().closest("[inert]")).not.toBeNull();
      expect(backLink().closest(".opacity-50")).not.toBeNull();

      act(() => {
        editBackend.releaseWrite?.();
      });
      await waitFor(() => {
        expect(push).toHaveBeenCalled();
      });
    });

    it("should write once for a double press", async () => {
      editBackend.holdingWrite = true;
      await renderForm();

      const button = saveButton();
      // Both presses arrive before the screen has drawn the first, so the disabled button cannot stop the second.
      act(() => {
        button.click();
        button.click();
      });

      await waitFor(() => {
        expect(writes()).toHaveLength(1);
      });
      act(() => {
        editBackend.releaseWrite?.();
      });
      await waitFor(() => {
        expect(push).toHaveBeenCalledTimes(1);
      });
      expect(writes()).toHaveLength(1);
    });
  });

  describe("a failed save", () => {
    it("should say the targets have not changed, keep every choice and put focus on Save changes", async () => {
      editBackend.failingWrite = true;
      await renderForm();
      fireEvent.click(radio(/^Maintain weight/));
      fireEvent.click(radio(/^High/));

      fireEvent.click(saveButton());

      const banner = await screen.findByRole("alert");
      expect(within(banner).getByText(PROGRAM_EDIT_FAILED_BANNER)).toBeTruthy();
      expect(radio(/^Maintain weight/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/^High/).getAttribute("aria-checked")).toBe("true");
      await waitFor(() => {
        expect(document.activeElement).toBe(saveButton());
      });
      expect(push).not.toHaveBeenCalled();
    });

    it("should say the same when only the recompute failed", async () => {
      editBackend.failingRecompute = true;
      await renderForm();

      fireEvent.click(saveButton());

      expect(await screen.findByText(PROGRAM_EDIT_FAILED_BANNER)).toBeTruthy();
    });

    it("should retry with the same button and drop the banner when it works", async () => {
      editBackend.failingWrite = true;
      await renderForm();
      fireEvent.click(saveButton());
      await screen.findByText(PROGRAM_EDIT_FAILED_BANNER);

      editBackend.failingWrite = false;
      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/more/program");
      });
      expect(screen.queryByText(PROGRAM_EDIT_FAILED_BANNER)).toBeNull();
      expect(writes()).toHaveLength(2);
    });
  });

  describe("offline with the form read", () => {
    it("should say a save needs a connection from the start, with Save changes off and the choices free", async () => {
      await renderForm();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(await screen.findByText(PROGRAM_EDIT.saveOffline)).toBeTruthy();
      expect(saveButton().hasAttribute("disabled")).toBe(true);
      expect(backLink().closest("[inert]")).toBeNull();
      fireEvent.click(radio(/^Maintain weight/));
      expect(radio(/^Maintain weight/).getAttribute("aria-checked")).toBe("true");
      fireEvent.click(saveButton());
      expect(editBackend.calls).toEqual([]);
    });

    it("should go when the connection returns, keeping the choices", async () => {
      await renderForm();
      act(() => {
        onlineManager.setOnline(false);
      });
      fireEvent.click(radio(/^Maintain weight/));
      await screen.findByText(PROGRAM_EDIT.saveOffline);

      act(() => {
        onlineManager.setOnline(true);
      });

      await waitFor(() => {
        expect(screen.queryByText(PROGRAM_EDIT.saveOffline)).toBeNull();
      });
      expect(saveButton().hasAttribute("disabled")).toBe(false);
      expect(radio(/^Maintain weight/).getAttribute("aria-checked")).toBe("true");
    });

    it("should replace a failed save with the offline notice, and not bring it back", async () => {
      editBackend.failingWrite = true;
      await renderForm();
      fireEvent.click(saveButton());
      await screen.findByText(PROGRAM_EDIT_FAILED_BANNER);

      act(() => {
        onlineManager.setOnline(false);
      });
      await screen.findByText(PROGRAM_EDIT.saveOffline);
      expect(screen.queryByText(PROGRAM_EDIT_FAILED_BANNER)).toBeNull();

      act(() => {
        onlineManager.setOnline(true);
      });
      await waitFor(() => {
        expect(screen.queryByText(PROGRAM_EDIT.saveOffline)).toBeNull();
      });
      expect(screen.queryByText(PROGRAM_EDIT_FAILED_BANNER)).toBeNull();
    });
  });

  describe("the reads", () => {
    it("should be the loading board, named, while they are on their way", async () => {
      renderScreen();

      expect(await screen.findByRole("status", { name: "Loading your programme" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: PROGRAM_EDIT.title })).toBeTruthy();
      await screen.findByRole("radiogroup", { name: "Goal" });
    });

    it("should be the error board with Try again when they fail online, and the form once it works", async () => {
      editBackend.failingReads.add("programs");
      renderScreen();

      expect(await screen.findByText("Couldn't load your programme")).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: PROGRAM_EDIT.title })).toBeTruthy();

      editBackend.failingReads.clear();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("radiogroup", { name: "Goal" })).toBeTruthy();
    });

    it("should be the error board with no Try again, never the loading board, when opened offline with nothing read", async () => {
      onlineManager.setOnline(false);
      renderScreen();

      expect(await screen.findByText("Couldn't load your programme")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.queryByRole("status", { name: "Loading your programme" })).toBeNull();
      expect(screen.getByRole("heading", { level: 1, name: PROGRAM_EDIT.title })).toBeTruthy();
      expect(backLink()).toBeTruthy();
    });

    it("should go to the Programme page when there is no programme", async () => {
      editBackend.program = null;
      renderScreen();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/more/program");
      });
    });

    it("should go to the Programme page when the programme ends while the form is open", async () => {
      const { queryClient } = await renderForm();
      editBackend.program = null;

      await act(async () => {
        await queryClient.invalidateQueries();
      });

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/more/program");
      });
    });

    it("should keep a half-made choice when a background read fails", async () => {
      const { queryClient } = await renderForm();
      fireEvent.click(radio(/^Maintain weight/));
      fireEvent.click(radio(/^High/));
      editBackend.failingReads.add("programs");

      await act(async () => {
        await queryClient.invalidateQueries();
      });

      expect(screen.queryByText("Couldn't load your programme")).toBeNull();
      expect(radio(/^Maintain weight/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/^High/).getAttribute("aria-checked")).toBe("true");
    });

    it("should not let a programme read that lands later overwrite a choice", async () => {
      const { queryClient } = await renderForm();
      fireEvent.click(radio(/^Maintain weight/));
      editBackend.program = { ...editBackend.program, goal: "gain", rate_pct_per_week: 0.25 };

      await act(async () => {
        await queryClient.invalidateQueries();
      });

      expect(radio(/^Maintain weight/).getAttribute("aria-checked")).toBe("true");
    });
  });
});

function Leavable() {
  const [isShown, setIsShown] = useState(true);

  return (
    <ToastProvider>
      {isShown && <ProgramEditScreen />}
      <button
        type="button"
        onClick={() => {
          setIsShown(false);
        }}
      >
        Leave
      </button>
    </ToastProvider>
  );
}

describe("Edit programme, what a save leaves behind and what the reads wait for", () => {
  it("should drop the programme and targets reads, so Programme reads fresh and never draws the figures from before", async () => {
    const { queryClient } = await renderForm();
    queryClient.setQueryData(keys.profiles.targets, {
      kcal: 2140,
      protein_g: 126,
      carbs_g: 245,
      fat_g: 73,
      source: "engine",
    });
    editBackend.holdingProgramReads = true;

    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/more/program");
    });

    // The slow read has not landed, and nothing from before the save is left to draw.
    expect(queryClient.getQueryData(keys.profiles.targets)).toBeUndefined();
    expect(queryClient.getQueryData(keys.program.summary)).toBeUndefined();
    // The form it drew stays until the page goes, with its choices.
    expect(screen.getByRole("radiogroup", { name: "Goal" })).toBeTruthy();
    expect(radio(/^Lose weight/).getAttribute("aria-checked")).toBe("true");

    act(() => {
      releaseHeldReads();
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(keys.program.summary)).toBeDefined();
    });
  });

  it("should colour the toast's icon for success", async () => {
    await renderForm();

    fireEvent.click(saveButton());

    const message = await screen.findByText(TARGETS_SAVED_TOAST);
    expect(message.parentElement?.querySelector("svg")?.getAttribute("class")).toContain(
      "stroke-success",
    );
  });

  it("should tell a person who left mid-save that it saved, and not take them back", async () => {
    editBackend.holdingWrite = true;
    renderWithEditBackend(<Leavable />);
    await screen.findByRole("radiogroup", { name: "Goal" });
    fireEvent.click(saveButton());
    await screen.findByRole("button", { name: "Saving" });

    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(screen.queryByRole("radiogroup", { name: "Goal" })).toBeNull();
    act(() => {
      editBackend.releaseWrite?.();
    });

    expect(await screen.findByText(TARGETS_SAVED_TOAST)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  describe("when the connection goes during the save", () => {
    it("should never leave the button spinning when the save then fails", async () => {
      editBackend.holdingWrite = true;
      editBackend.failingWrite = true;
      await renderForm();
      fireEvent.click(saveButton());
      await screen.findByRole("button", { name: "Saving" });

      act(() => {
        onlineManager.setOnline(false);
      });
      act(() => {
        editBackend.releaseWrite?.();
      });

      expect(await screen.findByText(PROGRAM_EDIT.saveOffline)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Saving" })).toBeNull();
      expect(saveButton().hasAttribute("disabled")).toBe(true);

      act(() => {
        onlineManager.setOnline(true);
      });
      expect(saveButton().hasAttribute("disabled")).toBe(false);
    });

    it("should go on to Programme when the write had landed, with no refetch waited for", async () => {
      editBackend.holdingWrite = true;
      await renderForm();
      fireEvent.click(saveButton());
      await screen.findByRole("button", { name: "Saving" });

      act(() => {
        onlineManager.setOnline(false);
      });
      act(() => {
        editBackend.releaseWrite?.();
      });

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/more/program");
      });
      expect(await screen.findByText(TARGETS_SAVED_TOAST)).toBeTruthy();
    });
  });

  describe("the weight and the unit", () => {
    it("should write the rate amounts in the person's unit", async () => {
      editBackend.weightUnit = "lb";
      await renderForm();

      expect(radio(/^0\.5% a week/).textContent).toContain(describeRateAmount(0.5, 80, "lb"));
      expect(describeRateAmount(0.5, 80, "lb")).toContain("lb");
    });

    it("should be the error board with Try again when no weight is known anywhere", async () => {
      editBackend.weighIns = [];
      editBackend.targets = [];
      renderScreen();

      expect(await screen.findByText("Couldn't load your programme")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.queryByRole("radiogroup", { name: "Goal" })).toBeNull();
    });

    it("should wait for the weight trend and never draw at a fallback weight and then change", async () => {
      editBackend.weighIns = [weighInRow("2026-11-05", 90), weighInRow("2026-10-20", 70)];
      const trendKg = computeTrend([
        { localDate: "2026-10-20", weightKg: 70 },
        { localDate: "2026-11-05", weightKg: 90 },
      ]).at(-1)?.trendKg;
      if (trendKg === undefined) {
        throw new Error("The fixture should have a trend");
      }
      editBackend.holdingWeighInList = true;
      const { queryClient } = renderScreen();

      await waitFor(() => {
        for (const key of [
          keys.program.summary,
          keys.profiles.setupState,
          keys.profiles.weightUnit,
          keys.profiles.timeZone,
        ]) {
          expect(queryClient.getQueryState(key)?.status).toBe("success");
        }
      });
      // Every read but the trend is in, and the latest weigh-in could already work the values out.
      expect(screen.queryByRole("radiogroup", { name: "Goal" })).toBeNull();
      expect(screen.getByRole("status", { name: "Loading your programme" })).toBeTruthy();

      act(() => {
        releaseHeldReads();
      });

      await screen.findByRole("radiogroup", { name: "Goal" });
      expect(radio(/^Moderate/).textContent).toContain(describeProteinGrams("moderate", trendKg));
      expect(radio(/^Moderate/).textContent).not.toContain(describeProteinGrams("moderate", 90));
    });
  });
});
