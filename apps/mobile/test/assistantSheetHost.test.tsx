import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { Text as MockText } from "react-native";

import { AssistantSheetHost, useOpenAssistant } from "../components/AssistantSheetHost";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantSheetProps } from "../components/AssistantSheet";

// The sheet has its own tests. Here it is a stand-in that says whether it is open, the day it was given and
// the time Describe logs at, so the host's side of it is what is tested: who opens it, how, and when it starts.
const mockSheetMounts = jest.fn();
jest.mock("../components/AssistantSheet", () => ({
  AssistantSheet: ({ open, localDate, describeAt, onClose }: AssistantSheetProps) => {
    mockSheetMounts();
    return (
      <MockText onPress={onClose}>
        {`${open ? "Sheet open" : "Sheet closed"} on ${localDate}${describeAt === undefined ? "" : ` describing at ${describeAt}`}`}
      </MockText>
    );
  },
}));

function OpenButtons() {
  const openAssistant = useOpenAssistant();

  return (
    <>
      <MockText
        onPress={() => {
          openAssistant({ localDate: "2026-10-15" });
        }}
      >
        Open from the diary
      </MockText>
      <MockText
        onPress={() => {
          openAssistant({ localDate: "2026-10-12", describeAt: "13:00" });
        }}
      >
        Open from Describe
      </MockText>
    </>
  );
}

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe("AssistantSheetHost", () => {
  beforeEach(() => {
    installVirtualClock();
    mockSheetMounts.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it("should not start the sheet until something opens it", async () => {
    await render(
      <AssistantSheetHost>
        <OpenButtons />
      </AssistantSheetHost>,
    );

    expect(mockSheetMounts).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Sheet /)).not.toBeOnTheScreen();
  });

  it("should draw what it hosts", async () => {
    await render(
      <AssistantSheetHost>
        <OpenButtons />
      </AssistantSheetHost>,
    );

    expect(screen.getByText("Open from the diary")).toBeOnTheScreen();
  });

  it("should open the sheet on the given day, with no time, from the diary", async () => {
    await render(
      <AssistantSheetHost>
        <OpenButtons />
      </AssistantSheetHost>,
    );

    await userSetup().press(screen.getByText("Open from the diary"));

    expect(screen.getByText("Sheet open on 2026-10-15")).toBeOnTheScreen();
  });

  it("should open the sheet on the day and at the time being logged from Describe", async () => {
    await render(
      <AssistantSheetHost>
        <OpenButtons />
      </AssistantSheetHost>,
    );

    await userSetup().press(screen.getByText("Open from Describe"));

    expect(screen.getByText("Sheet open on 2026-10-12 describing at 13:00")).toBeOnTheScreen();
  });

  it("should keep the sheet mounted, closed, after it is closed, so a stopped answer is still there", async () => {
    await render(
      <AssistantSheetHost>
        <OpenButtons />
      </AssistantSheetHost>,
    );
    await userSetup().press(screen.getByText("Open from the diary"));

    await userSetup().press(screen.getByText("Sheet open on 2026-10-15"));

    expect(screen.getByText("Sheet closed on 2026-10-15")).toBeOnTheScreen();
  });

  it("should open the next time as asked, so Describe's time does not stay on the diary's sheet", async () => {
    await render(
      <AssistantSheetHost>
        <OpenButtons />
      </AssistantSheetHost>,
    );
    await userSetup().press(screen.getByText("Open from Describe"));
    await userSetup().press(screen.getByText(/^Sheet open/));

    await userSetup().press(screen.getByText("Open from the diary"));

    expect(screen.getByText("Sheet open on 2026-10-15")).toBeOnTheScreen();
  });

  it("should do nothing outside a host, as a screen under test does", async () => {
    await render(<OpenButtons />);

    await act(async () => {
      await userSetup().press(screen.getByText("Open from Describe"));
    });

    expect(screen.queryByText(/^Sheet /)).not.toBeOnTheScreen();
  });
});
