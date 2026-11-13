import { KeyLowProvider } from "@keylow/api-client";
import {
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_DESCRIBE,
  ASSISTANT_OFFLINE,
  ASSISTANT_SHEET,
} from "@keylow/core/copy";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FUNCTIONS_URL,
  panelBackend,
  panelClient,
  panelFetch,
  resetPanelBackend,
  signInPanelClient,
} from "./assistantPanelBackend";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";
import { AssistantDock, AssistantProvider } from "@/components/assistant";
import { ToastProvider } from "@/components/ui/Toast";
import { FoodLogActionsProvider, useFoodLogActions } from "@/lib/foodLogActions";

const pathname = vi.hoisted(() => vi.fn<() => string>());

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom has no layout, so the breakpoint is whatever a test says it is.
function setWindowWidth(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: width >= 1024 && query === "(min-width: 1024px)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

// What the turn route was sent, read from the request as the browser sends it.
const sentTurns: Record<string, unknown>[] = [];

async function recordingFetch(input: string | URL | globalThis.Request, init?: RequestInit) {
  if (
    new globalThis.Request(input, init).url.endsWith("/assistant/turn") &&
    typeof init?.body === "string"
  ) {
    const body: unknown = JSON.parse(init.body);
    if (typeof body === "object" && body !== null) {
      sentTurns.push({ ...body });
    }
  }
  return panelFetch(input, init);
}

// What the diary's hour plus does: it asks for the Add food dialog on a day, at an hour.
function PastDayPlus() {
  const { openAddFood } = useFoodLogActions();
  return (
    <button
      type="button"
      onClick={() => {
        openAddFood({ date: "2026-10-15", time: "13:00" });
      }}
    >
      Add at 13:00
    </button>
  );
}

async function renderApp() {
  pathname.mockReturnValue("/diary");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <KeyLowProvider client={panelClient} functionsUrl={FUNCTIONS_URL} queryClient={queryClient}>
      <ToastProvider>
        <FoodLogActionsProvider>
          <AssistantProvider>
            <DashboardNav />
            <AssistantDock>
              <main>
                <PastDayPlus />
              </main>
            </AssistantDock>
          </AssistantProvider>
        </FoodLogActionsProvider>
      </ToastProvider>
    </KeyLowProvider>,
  );
  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });
}

const field = () => screen.getByRole("textbox", { name: ASSISTANT_SHEET.composerLabel });
const addFoodDialog = () => screen.queryByRole("dialog", { name: "Add food" });

async function describeFromTheDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add at 13:00" }));
  await user.click(screen.getByRole("button", { name: /^Describe/ }));
}

describe("Describe from the add food dialog", () => {
  beforeEach(async () => {
    resetPanelBackend();
    sentTurns.length = 0;
    setWindowWidth(375);
    vi.stubGlobal("fetch", recordingFetch);
    onlineManager.setOnline(true);
    await signInPanelClient();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    onlineManager.setOnline(true);
  });

  it("should close the dialog and open the assistant with the Describe intro in place of the starters", async () => {
    const user = userEvent.setup();
    await renderApp();

    await describeFromTheDialog(user);

    expect(addFoodDialog()).toBeNull();
    const panel = await screen.findByRole("dialog", { name: ASSISTANT_SHEET.title });
    expect(
      await within(panel).findByRole("heading", { name: ASSISTANT_DESCRIBE.emptyHeading }),
    ).toBeTruthy();
    expect(within(panel).queryByRole("region", { name: ASSISTANT_SHEET.startersLabel })).toBeNull();
  });

  it("should show the time being logged as a chip over the field, with the hint", async () => {
    const user = userEvent.setup();
    await renderApp();

    await describeFromTheDialog(user);

    expect(await screen.findByText("Logs at 13:00")).toBeTruthy();
    expect(screen.getByText(ASSISTANT_DESCRIBE.hintText)).toBeTruthy();
    expect(field().getAttribute("placeholder")).toBe(ASSISTANT_DESCRIBE.composerPlaceholder);
  });

  it("should leave focus in the assistant's field, not on the diary the dialog came from", async () => {
    const user = userEvent.setup();
    await renderApp();

    await describeFromTheDialog(user);

    await waitFor(() => {
      expect(document.activeElement).toBe(field());
    });
  });

  it("should leave focus in the field when the panel is docked beside the page", async () => {
    setWindowWidth(1280);
    const user = userEvent.setup();
    await renderApp();

    await describeFromTheDialog(user);

    await waitFor(() => {
      expect(document.activeElement).toBe(field());
    });
  });

  it("should send what is described for the day and the time being logged", async () => {
    const user = userEvent.setup();
    await renderApp();
    await describeFromTheDialog(user);
    await waitFor(() => {
      expect(document.activeElement).toBe(field());
    });

    await user.type(field(), "2 eggs and a slice of toast{Enter}");

    await waitFor(() => {
      expect(sentTurns).toEqual([
        expect.objectContaining({
          text: "2 eggs and a slice of toast",
          localDate: "2026-10-15",
          localTime: "13:00",
        }),
      ]);
    });
  });

  it("should open the plain assistant, with no chip, from the top bar afterwards", async () => {
    const user = userEvent.setup();
    await renderApp();
    await describeFromTheDialog(user);
    await screen.findByText("Logs at 13:00");
    await user.click(
      within(screen.getByRole("dialog", { name: ASSISTANT_SHEET.title })).getByRole("button", {
        name: ASSISTANT_SHEET.closeLabel,
      }),
    );

    await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.title }));

    expect(await screen.findByRole("region", { name: ASSISTANT_SHEET.startersLabel })).toBeTruthy();
    expect(screen.queryByText("Logs at 13:00")).toBeNull();
  });

  it("should not take focus back into the field when it appears later, once the person has moved on", async () => {
    panelBackend.isConsentGiven = false;
    setWindowWidth(1280);
    const user = userEvent.setup();
    await renderApp();
    await describeFromTheDialog(user);
    const consentCard = await screen.findByRole("button", {
      name: ASSISTANT_CONSENT_CARD.turnOnLabel,
    });
    const pageButton = screen.getByRole("button", { name: "Add at 13:00" });
    pageButton.focus();

    fireEvent.click(consentCard);
    await screen.findByRole("textbox", { name: ASSISTANT_SHEET.composerLabel });

    expect(document.activeElement).not.toBe(field());
  });

  it("should have the field off and no chip when the app goes offline", async () => {
    const user = userEvent.setup();
    await renderApp();
    await describeFromTheDialog(user);
    await screen.findByText("Logs at 13:00");

    onlineManager.setOnline(false);

    await waitFor(() => {
      expect(field().hasAttribute("disabled")).toBe(true);
    });
    expect(field().getAttribute("placeholder")).toBe(ASSISTANT_OFFLINE.fieldText);
    expect(screen.queryByText("Logs at 13:00")).toBeNull();
  });
});
