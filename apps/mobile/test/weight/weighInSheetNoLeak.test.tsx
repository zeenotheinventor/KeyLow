import { cleanup, screen, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  ONLY_THE_DATE,
  SHEET_NOW,
  manualWeighIn,
  renderWeighInSheet,
} from "../support/weighInSheetHarness";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
} from "../support/weightBackend";

import type { QueryClient } from "@tanstack/react-query";

// Weigh-ins are health data: no weight, note or time reaches a log or an error, whatever fails.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const NOTE = "after the long run, felt heavy";
const WEIGHT = "99.4";
const levels = ["log", "info", "warn", "error"] as const;

// Everything the sheet's render, writes and failures wrote to the console, as one text.
let written: string[];
let queryClient: QueryClient;

function spyOnConsole() {
  written = [];
  for (const level of levels) {
    jest.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
      written.push(
        parts
          .map((part) => (part instanceof Error ? String(part.cause) + part.message : String(part)))
          .join(" "),
      );
    });
  }
}

function expectNothingPrivateWritten() {
  const text = written.join("\n");
  for (const secret of [WEIGHT, "81.4", NOTE, "Before breakfast", "08:15", "07:15"]) {
    expect(text).not.toContain(secret);
  }
}

describe("the weigh-in sheet's console output and errors", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: SHEET_NOW, doNotFake: [...ONLY_THE_DATE] });
    resetWeightBackend();
    queryClient = createWeightQueryClient();
    spyOnConsole();
    weightBackend.weighInWritesFail = true;
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  it("should write nothing private to the console when an add fails, nor show it in the alert", async () => {
    const { user } = await renderWeighInSheet(queryClient);
    await user.type(screen.getByLabelText("Weight (kg)"), WEIGHT);
    await user.type(screen.getByLabelText(/^Note/), NOTE);

    await user.press(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent(WEIGHT);
    expect(alert).not.toHaveTextContent(NOTE);
    expectNothingPrivateWritten();
  });

  it("should write nothing private to the console when an edit fails or finds no manual row", async () => {
    weightBackend.weighInWritesFail = false;
    weightBackend.updatesMatchNoRow = true;
    weightBackend.weighIns = [{ ...manualWeighIn }];
    const { user } = await renderWeighInSheet(queryClient, { weighIn: manualWeighIn });
    await user.clear(screen.getByLabelText("Weight (kg)"));
    await user.type(screen.getByLabelText("Weight (kg)"), WEIGHT);

    await user.press(screen.getByRole("button", { name: "Save" }));

    await screen.findByRole("alert");
    expectNothingPrivateWritten();
  });

  it("should write nothing private to the console when a delete fails", async () => {
    weightBackend.weighIns = [{ ...manualWeighIn }];
    const { user } = await renderWeighInSheet(queryClient, { weighIn: manualWeighIn });

    await user.press(screen.getByRole("button", { name: "Delete weigh-in" }));

    await screen.findByRole("alert");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete weigh-in" })).toBeEnabled();
    });
    expectNothingPrivateWritten();
  });
});
