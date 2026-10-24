import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen } from "@testing-library/react-native";

import { ExpenditureChartCard } from "../components/ProgramScreen/ExpenditureChartCard";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { programBackend, programClient, resetProgramBackend } from "./support/programBackend";

import type { ViewStyle } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The empty and the error states sit among the cards of the screen, so they are the kit's `card` variant: the
// height of their words, with 20 points above and at the sides and 16 below, as the kit's own tests pin it.
const CARD_WORDS = {
  alignItems: "center",
  rowGap: 8,
  paddingTop: 20,
  paddingLeft: 20,
  paddingRight: 20,
  paddingBottom: 16,
} satisfies ViewStyle;

async function renderCard() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
        <ExpenditureChartCard />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("the expenditure chart card's empty and error states", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetProgramBackend();
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("should draw the empty state as a card, not a view that fills the screen", async () => {
    await renderCard();

    expect(await screen.findByRole("heading", { name: "No estimates yet" })).toBeOnTheScreen();
    expect(screen.getByRole("heading", { name: "No estimates yet" }).parent).toHaveStyle(
      CARD_WORDS,
    );
  });

  it("should draw the error state as a card, not a view that fills the screen", async () => {
    programBackend.expenditureHistoryFails = true;
    await renderCard();

    expect(await screen.findByRole("alert")).toBeOnTheScreen();
    expect(screen.getByRole("alert").parent).toHaveStyle(CARD_WORDS);
  });
});
