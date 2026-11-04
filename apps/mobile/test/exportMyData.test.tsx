import { serialiseAccountExport } from "@keylow/core";
import { act, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import ExportMyDataRoute from "../app/(tabs)/more/export";
import { ThemeProvider } from "../lib/theme";
import { fakePickedDirectory, madeUpAccountExport } from "./support/accountExportFixtures";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { AccountExport } from "@keylow/core";

type PickedDirectory = ReturnType<typeof fakePickedDirectory>;

// What the two outside calls answer. The read is tested where it lives, in `@keylow/api-client`, and the picker
// and the write are the phone's.
const mockBackend: {
  exportMyData: jest.Mock<Promise<AccountExport>, []>;
  pickDirectory: jest.Mock<Promise<PickedDirectory | undefined>, []>;
} = {
  exportMyData: jest.fn<Promise<AccountExport>, []>(),
  pickDirectory: jest.fn<Promise<PickedDirectory | undefined>, []>(),
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  exportMyData: () => mockBackend.exportMyData(),
}));
jest.mock("expo-file-system", () => ({
  Directory: { pickDirectoryAsync: () => mockBackend.pickDirectory() },
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// Moves the date the screen reads and leaves every timer running.
const ONLY_THE_DATE = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

// The screen reads the device zone from Intl, so a test pins it. Without that the date depends on the runner.
function setDeviceTimeZone(timeZone: string) {
  jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
    locale: "en-GB",
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone,
  }));
}

function setNow(instant: string) {
  jest.useFakeTimers({ now: new Date(instant), doNotFake: [...ONLY_THE_DATE] });
}

// Words of the boards `export · exporting`, `done` and `failed`, written out again here so a change to the
// copy file is seen by this test.
const WORDS = {
  contentsBody:
    "Everything in your account as one JSON file: your diary, weigh-ins, foods, recipes, programme, training and assistant conversations.",
  healthData:
    "This file holds your health data. Keep it safe, and share it only where you mean to.",
  preparingCaption: "This can take a minute. Keep Ki-Lo open.",
  preparingFooter: "You can save the file once it is ready.",
  readyFooter:
    "Save file asks you to pick a folder on your phone. The file stays there until you move or delete it.",
  savedFooter: "Open your Files app to share it.",
  failedTitle: "The export did not finish",
  failedBody: "Nothing was saved. Try again.",
};

const FILE_NAME = "ki-lo-export-2026-11-04.json";

// A made-up export whose file is 1,849,xxx bytes, which the screen words "1.8 MB".
const bigNote = "a".repeat(1_849_000);

// The made-up export held by a promise the test settles, so each state can be looked at while it lasts.
function holdTheExport() {
  let resolveExport: (data: AccountExport) => void = () => undefined;
  let rejectExport: (error: Error) => void = () => undefined;
  mockBackend.exportMyData.mockImplementationOnce(
    () =>
      new Promise<AccountExport>((resolve, reject) => {
        resolveExport = resolve;
        rejectExport = reject;
      }),
  );
  return {
    resolve: (data: AccountExport) =>
      act(() => {
        resolveExport(data);
      }),
    reject: (error: Error) =>
      act(() => {
        rejectExport(error);
      }),
  };
}

async function renderScreen() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ExportMyDataRoute />
    </ThemeProvider>,
  );
  return user;
}

describe("the Export my data screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/ExportMyDataScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockBackend.exportMyData.mockReset();
    mockBackend.pickDirectory.mockReset();
    setDeviceTimeZone("Europe/London");
    setNow("2026-11-04T10:00:00Z");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("its header and the cards that stay in every state", () => {
    it("should be headed Export my data, with Back to More", async () => {
      holdTheExport();
      const user = await renderScreen();

      expect(screen.getByRole("heading", { name: "Export my data" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to More" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to More when there is no screen to go back to", async () => {
      holdTheExport();
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderScreen();

      await user.press(screen.getByRole("button", { name: "Back to More" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });

    it("should say what the file holds and warn that it is health data, while preparing", async () => {
      holdTheExport();
      await renderScreen();

      expect(screen.getByRole("heading", { name: "What the file holds" })).toBeOnTheScreen();
      expect(screen.getByText(WORDS.contentsBody)).toBeOnTheScreen();
      expect(screen.getByText(WORDS.healthData)).toBeOnTheScreen();
    });

    function expectBothCards() {
      expect(screen.getByRole("heading", { name: "What the file holds" })).toBeOnTheScreen();
      expect(screen.getByText(WORDS.contentsBody)).toBeOnTheScreen();
      expect(screen.getByText(WORDS.healthData)).toBeOnTheScreen();
    }

    it("should keep both cards once the file is ready", async () => {
      const held = holdTheExport();
      await renderScreen();
      await held.resolve(madeUpAccountExport());

      await screen.findByRole("button", { name: "Done" });
      expectBothCards();
    });

    it("should keep both cards once the file is saved", async () => {
      const held = holdTheExport();
      mockBackend.pickDirectory.mockResolvedValue(fakePickedDirectory("Downloads"));
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport());
      await user.press(await screen.findByRole("button", { name: "Save file" }));

      await screen.findByRole("img", { name: "Saved" });
      expectBothCards();
    });

    it("should keep both cards when the export fails", async () => {
      const held = holdTheExport();
      await renderScreen();
      await held.reject(new Error("boom"));

      await screen.findByRole("alert");
      expectBothCards();
    });
  });

  describe("export · exporting", () => {
    it("should start the export once, as the screen opens", async () => {
      holdTheExport();
      await renderScreen();

      expect(mockBackend.exportMyData).toHaveBeenCalledTimes(1);
    });

    it("should show the progress row, Save file disabled, and the caption under it", async () => {
      holdTheExport();
      await renderScreen();

      expect(screen.getByText("Preparing your file")).toBeOnTheScreen();
      expect(screen.getByText(WORDS.preparingCaption)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save file" })).toBeDisabled();
      expect(screen.getByText(WORDS.preparingFooter)).toBeOnTheScreen();
    });

    it("should offer nothing but Back and the disabled Save file", async () => {
      holdTheExport();
      await renderScreen();

      expect(screen.queryByRole("button", { name: "Done" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
    });

    it("should not pick a folder when the disabled Save file is pressed", async () => {
      holdTheExport();
      const user = await renderScreen();

      await user.press(screen.getByRole("button", { name: "Save file" }));

      expect(mockBackend.pickDirectory).not.toHaveBeenCalled();
    });
  });

  describe("export · done, ready", () => {
    it("should draw the file row with today's date in the device's zone, its size and the Ready tick", async () => {
      const held = holdTheExport();
      await renderScreen();
      await held.resolve(madeUpAccountExport(bigNote));

      expect(
        await screen.findByLabelText(`${FILE_NAME}, 1.8 MB · Ready to save`),
      ).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Ready" })).toBeOnTheScreen();
      expect(screen.queryByText("Preparing your file")).not.toBeOnTheScreen();
    });

    it("should name the file for the day it is in the device's zone, not in UTC", async () => {
      setDeviceTimeZone("Pacific/Auckland");
      setNow("2026-11-04T23:30:00Z");
      const held = holdTheExport();
      await renderScreen();
      await held.resolve(madeUpAccountExport());

      expect(
        await screen.findByLabelText("ki-lo-export-2026-11-05.json, 1 KB · Ready to save"),
      ).toBeOnTheScreen();
    });

    it("should size the file by its UTF-8 bytes, where a two byte letter counts twice", async () => {
      const held = holdTheExport();
      await renderScreen();
      await held.resolve(madeUpAccountExport("é".repeat(500_000)));

      expect(
        await screen.findByLabelText(`${FILE_NAME}, 1.0 MB · Ready to save`),
      ).toBeOnTheScreen();
    });

    it("should offer Save file, Done and the caption about picking a folder", async () => {
      const held = holdTheExport();
      await renderScreen();
      await held.resolve(madeUpAccountExport());

      expect(await screen.findByRole("button", { name: "Save file" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
      expect(screen.getByText(WORDS.readyFooter)).toBeOnTheScreen();
    });

    it("should go back to More on Done, without saving", async () => {
      const held = holdTheExport();
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport());

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(mockBackend.pickDirectory).not.toHaveBeenCalled();
    });
  });

  describe("Save file", () => {
    it("should create the file in the picked folder as JSON and write the serialised export", async () => {
      const data = madeUpAccountExport();
      const held = holdTheExport();
      const folder = fakePickedDirectory("Downloads");
      mockBackend.pickDirectory.mockResolvedValue(folder);
      const user = await renderScreen();
      await held.resolve(data);

      await user.press(await screen.findByRole("button", { name: "Save file" }));

      await waitFor(() => {
        expect(folder.write).toHaveBeenCalledTimes(1);
      });
      expect(folder.createFile).toHaveBeenCalledWith(FILE_NAME, "application/json");
      expect(folder.write).toHaveBeenCalledWith(serialiseAccountExport(data));
    });

    it("should show the Save file button busy while the folder is being picked", async () => {
      const held = holdTheExport();
      mockBackend.pickDirectory.mockReturnValue(new Promise(() => undefined));
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport());

      await user.press(await screen.findByRole("button", { name: "Save file" }));

      // The label is hidden while the spinner shows, so the busy button is found by its state.
      expect(screen.getByRole("button", { busy: true })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    });

    it("should ask for a folder once when Save file is pressed twice", async () => {
      const held = holdTheExport();
      mockBackend.pickDirectory.mockReturnValue(new Promise(() => undefined));
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport());
      const save = await screen.findByRole("button", { name: "Save file" });

      await user.press(save);
      await user.press(save);

      expect(mockBackend.pickDirectory).toHaveBeenCalledTimes(1);
    });
  });

  describe("export · done, saved", () => {
    async function saveToFolder(folderName: string, note = "after a run") {
      const held = holdTheExport();
      mockBackend.pickDirectory.mockResolvedValue(fakePickedDirectory(folderName));
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport(note));
      await user.press(await screen.findByRole("button", { name: "Save file" }));
      return user;
    }

    it("should say where it was saved, with the picked folder's own name, and the Saved tick", async () => {
      await saveToFolder("Downloads", bigNote);

      expect(
        await screen.findByLabelText(`${FILE_NAME}, 1.8 MB · Saved to Downloads`),
      ).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Saved" })).toBeOnTheScreen();
      expect(screen.queryByRole("img", { name: "Ready" })).not.toBeOnTheScreen();
    });

    it("should use whatever name the picked folder has", async () => {
      await saveToFolder("Documents");

      expect(
        await screen.findByLabelText(`${FILE_NAME}, 1 KB · Saved to Documents`),
      ).toBeOnTheScreen();
    });

    // A recommendation, awaiting Zee: no board draws a folder with no name.
    it("should say the folder you picked when the folder has no name", async () => {
      await saveToFolder("");

      expect(
        await screen.findByLabelText(`${FILE_NAME}, 1 KB · Saved to the folder you picked`),
      ).toBeOnTheScreen();
    });

    it("should leave Done as the only button, with its caption", async () => {
      await saveToFolder("Downloads");

      expect(await screen.findByRole("button", { name: "Done" })).toBeEnabled();
      expect(screen.getByText(WORDS.savedFooter)).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save file" })).not.toBeOnTheScreen();
      expect(screen.queryByText(WORDS.readyFooter)).not.toBeOnTheScreen();
    });

    it("should go back to More on Done", async () => {
      const user = await saveToFolder("Downloads");

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("a cancelled picker", () => {
    it.each([
      ["rejects", () => mockBackend.pickDirectory.mockRejectedValue(new Error("cancelled"))],
      ["returns no folder", () => mockBackend.pickDirectory.mockResolvedValue(undefined)],
    ])("should go back to ready, with no error, when the picker %s", async (_name, arrange) => {
      const held = holdTheExport();
      arrange();
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport());

      await user.press(await screen.findByRole("button", { name: "Save file" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save file" })).toBeEnabled();
      });
      expect(screen.getByLabelText(`${FILE_NAME}, 1 KB · Ready to save`)).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.queryByText(WORDS.failedTitle)).not.toBeOnTheScreen();
    });

    it("should let the person pick a folder again afterwards", async () => {
      const held = holdTheExport();
      const folder = fakePickedDirectory("Downloads");
      mockBackend.pickDirectory.mockRejectedValueOnce(new Error("cancelled"));
      mockBackend.pickDirectory.mockResolvedValueOnce(folder);
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport());

      await user.press(await screen.findByRole("button", { name: "Save file" }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save file" })).toBeEnabled();
      });
      await user.press(screen.getByRole("button", { name: "Save file" }));

      expect(
        await screen.findByLabelText(`${FILE_NAME}, 1 KB · Saved to Downloads`),
      ).toBeOnTheScreen();
      expect(mockBackend.exportMyData).toHaveBeenCalledTimes(1);
    });
  });

  describe("export · failed", () => {
    it("should show the danger banner and Try again when the export fails", async () => {
      const held = holdTheExport();
      await renderScreen();
      await held.reject(new Error("a database message"));

      const banner = await screen.findByRole("alert");

      expect(within(banner).getByText(WORDS.failedTitle)).toBeOnTheScreen();
      expect(within(banner).getByText(WORDS.failedBody)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      expect(screen.queryByText("Preparing your file")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save file" })).not.toBeOnTheScreen();
    });

    it("should show the same banner when the write fails", async () => {
      const held = holdTheExport();
      const folder = fakePickedDirectory("Downloads");
      folder.write.mockImplementation(() => {
        throw new Error("no space left");
      });
      mockBackend.pickDirectory.mockResolvedValue(folder);
      const user = await renderScreen();
      await held.resolve(madeUpAccountExport());

      await user.press(await screen.findByRole("button", { name: "Save file" }));

      expect(
        within(await screen.findByRole("alert")).getByText(WORDS.failedBody),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    });

    it("should run the export again from preparing on Try again", async () => {
      const held = holdTheExport();
      const user = await renderScreen();
      await held.reject(new Error("a database message"));
      const second = holdTheExport();

      await user.press(await screen.findByRole("button", { name: "Try again" }));

      expect(mockBackend.exportMyData).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Preparing your file")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      await second.resolve(madeUpAccountExport());
      expect(await screen.findByLabelText(`${FILE_NAME}, 1 KB · Ready to save`)).toBeOnTheScreen();
    });

    it("should show none of an error's message, on the screen or in the console", async () => {
      const secret = "row 41 weigh_ins weight_kg 80.5";
      const consoleCalls = [
        jest.spyOn(console, "error").mockImplementation(() => undefined),
        jest.spyOn(console, "warn").mockImplementation(() => undefined),
        jest.spyOn(console, "log").mockImplementation(() => undefined),
      ];
      const held = holdTheExport();
      await renderScreen();
      await held.reject(new Error(secret));

      await screen.findByRole("alert");

      expect(screen.queryByText(new RegExp(secret))).not.toBeOnTheScreen();
      expect(JSON.stringify(consoleCalls.map((spy) => spy.mock.calls))).not.toContain(secret);
    });
  });
});
