import { describeGoalAnswerRows } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { GoalAnswerRow } from "../../components/GoalQuestionnaire";
import { GroupedList } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { GoalAnswers } from "@keylow/core/training";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Every kind of equipment but a gym's full set, so the answer is a long list of names.
const answers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "smith_machine",
    "ez_bar",
    "band",
    "bodyweight",
    "other",
  ],
  experience: "intermediate",
};

function Rows({ onPress }: { onPress: (step: string) => void }) {
  return (
    <ThemeProvider fixedPreference="dark">
      <GroupedList hidesTitle title="Goal">
        {describeGoalAnswerRows(answers).map((row) => (
          <GoalAnswerRow
            key={row.step}
            label={row.label}
            name={row.name}
            value={row.value}
            onPress={() => {
              onPress(row.step);
            }}
          />
        ))}
      </GroupedList>
    </ThemeProvider>
  );
}

describe("the Goal screen's answer row", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should be a button named with the question, the answer and Change", async () => {
    await render(<Rows onPress={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Goal: Look better. Change" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Days a week: 4. Change" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Session: 60 minutes. Change" })).toBeEnabled();
  });

  it("should open the question of the row pressed", async () => {
    const onPress = jest.fn<undefined, [string]>();
    const user = userEvent.setup();
    await render(<Rows onPress={onPress} />);

    await user.press(screen.getByRole("button", { name: "Days a week: 4. Change" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith("days");
  });

  it("should draw a long Equipment answer in full, with no line limit, so it wraps", async () => {
    await render(<Rows onPress={jest.fn()} />);
    const equipment = describeGoalAnswerRows(answers).find((row) => row.step === "equipment");

    expect(equipment?.value.length).toBeGreaterThan(60);
    const row = screen.getByRole("button", { name: `Equipment: ${equipment?.value}. Change` });
    const value = screen.getByText(equipment?.value ?? "");
    expect(row).toBeOnTheScreen();
    expect(value).not.toHaveProp("numberOfLines");
  });
});
