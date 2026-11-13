import { KeyLowProvider } from "@keylow/api-client";
import {
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_NOT_MEDICAL_ADVICE,
  ASSISTANT_OFFLINE,
  ASSISTANT_SHEET,
  ASSISTANT_STOPPED,
  ASSISTANT_TRAIN_SHEET,
  LEGAL_PATHS,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import {
  CONVERSATION_ID,
  TURN_ID,
  eventText,
  openTurnResponse,
  replyEvents,
  turnResponse,
} from "../../../../packages/api-client/test/support/assistantStream";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";
import { AssistantDock, AssistantProvider } from "@/components/assistant";
import { ToastProvider } from "@/components/ui/Toast";

const { pathname, viewedDate } = vi.hoisted(() => ({
  pathname: vi.fn<() => string>(),
  viewedDate: vi.fn<() => string | undefined>(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFood: vi.fn(), viewedDate: viewedDate() }),
}));

// jsdom has no layout, so the breakpoint is whatever a test says it is, and a test can change it while the
// panel is on screen.
let windowWidth = 375;
const mediaListeners = new Set<() => void>();

function setWindowWidth(width: number) {
  windowWidth = width;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return windowWidth >= 1024 && query === "(min-width: 1024px)";
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      mediaListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      mediaListeners.delete(listener);
    },
  }));
}

function resizeWindow(width: number) {
  windowWidth = width;
  act(() => {
    mediaListeners.forEach((listener) => {
      listener();
    });
  });
}

async function renderApp(path = "/diary") {
  pathname.mockReturnValue(path);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // A new element each time, so a rerender really renders the app again.
  const app = () => (
    <KeyLowProvider client={panelClient} functionsUrl={FUNCTIONS_URL} queryClient={queryClient}>
      <ToastProvider>
        <AssistantProvider>
          <DashboardNav />
          <AssistantDock>
            <main>
              <h1>The page</h1>
            </main>
          </AssistantDock>
        </AssistantProvider>
      </ToastProvider>
    </KeyLowProvider>
  );
  const view = render(app());
  // The profile's time zone is read before the first press, as it is in the app.
  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });
  return {
    ...view,
    // The page changes under the panel, as a client navigation does.
    goTo: (nextPath: string) => {
      pathname.mockReturnValue(nextPath);
      view.rerender(app());
    },
  };
}

const assistantButton = () => screen.getByRole("button", { name: ASSISTANT_SHEET.title });
const field = () => screen.getByRole("textbox", { name: ASSISTANT_SHEET.composerLabel });
const sendButton = () => screen.getByRole("button", { name: ASSISTANT_SHEET.sendLabel });
const panel = () => screen.getByRole("dialog", { name: ASSISTANT_SHEET.title });

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(assistantButton());
  // The panel has read its status and conversation when the starters or the consent card are drawn.
  await screen.findByRole("region", { name: ASSISTANT_SHEET.startersLabel });
}

const turnEvent = eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID });

// A stream the test writes to as it likes, as a turn being written is.
function controlledStream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(started) {
      controller = started;
    },
  });
  return {
    response: new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
    push: (text: string) => {
      controller?.enqueue(encoder.encode(text));
    },
  };
}

const stoppedStream = (text: string) =>
  openTurnResponse(
    eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
      eventText({ type: "text", delta: text }),
  );

describe("the assistant panel", () => {
  beforeEach(async () => {
    resetPanelBackend();
    mediaListeners.clear();
    viewedDate.mockReturnValue(undefined);
    setWindowWidth(375);
    vi.stubGlobal("fetch", panelFetch);
    onlineManager.setOnline(true);
    await signInPanelClient();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });

  describe("the top bar button", () => {
    it("should open the panel, and close it again, as a button that says whether it is open", async () => {
      const user = userEvent.setup();
      await renderApp();
      expect(assistantButton().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();

      await user.click(assistantButton());

      expect(panel()).toBeTruthy();
      expect(assistantButton().getAttribute("aria-expanded")).toBe("true");

      await user.click(assistantButton());

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
      expect(assistantButton().getAttribute("aria-expanded")).toBe("false");
    });

    it("should close from the Close button in the panel's header", async () => {
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
    });

    it("should close on Escape and give focus back to the Assistant button", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
      expect(document.activeElement).toBe(assistantButton());
    });

    it("should move focus to the field when the panel opens", async () => {
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      await waitFor(() => {
        expect(document.activeElement).toBe(field());
      });
    });
  });

  describe("the frame", () => {
    it("should be a modal dialog below the large breakpoint", async () => {
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      expect(panel().getAttribute("aria-modal")).toBe("true");
    });

    it("should keep Tab inside the sheet while it is modal", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      const close = within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel });
      close.focus();

      await user.tab();
      expect(panel().contains(document.activeElement)).toBe(true);
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });

      expect(panel().contains(document.activeElement)).toBe(true);
    });

    it("should be a complementary region, not modal, at the large breakpoint", async () => {
      setWindowWidth(1280);
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      const docked = screen.getByRole("complementary", { name: ASSISTANT_SHEET.title });
      expect(docked.getAttribute("aria-modal")).toBeNull();
      expect(screen.getByRole("heading", { name: "The page" })).toBeTruthy();
    });

    it("should take no room on the page while it is closed, though it stays mounted", async () => {
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());
      await user.click(assistantButton());

      const closed = screen.getByRole("dialog", { hidden: true });

      // The display classes are Tailwind's, which jsdom does not load, so the classes are what is read.
      expect(closed.classList.contains("hidden")).toBe(true);
      expect(closed.classList.contains("flex")).toBe(false);
    });

    it("should stay mounted when it is closed, so what was typed is still there when it opens again", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.type(field(), "half a thought");

      await user.click(assistantButton());
      await user.click(assistantButton());

      expect((field() as HTMLTextAreaElement).value).toBe("half a thought");
    });
  });

  describe("closing", () => {
    it("should give focus back to the Assistant button when the Close button closes the panel", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));

      expect(document.activeElement).toBe(assistantButton());
    });

    it("should give focus back to the Assistant button when Not now closes the consent card", async () => {
      panelBackend.isConsentGiven = false;
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());
      await user.click(
        await screen.findByRole("button", { name: ASSISTANT_CONSENT_CARD.notNowLabel }),
      );

      expect(document.activeElement).toBe(assistantButton());
    });

    it("should stop the page behind scrolling while the sheet is open, and let it scroll again once it is closed", async () => {
      const user = userEvent.setup();
      await renderApp();
      expect(document.body.style.overflow).toBe("");

      await user.click(assistantButton());
      expect(document.body.style.overflow).toBe("hidden");

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));
      expect(document.body.style.overflow).toBe("");
    });

    it("should leave the page scrolling beside the docked panel", async () => {
      setWindowWidth(1280);
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("the docked panel's top", () => {
    const pageTop = (top: number) =>
      vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(() => ({ top }) as DOMRect);
    const panelTop = () =>
      screen
        .getByRole("complementary", { name: ASSISTANT_SHEET.title })
        .style.getPropertyValue("--assistant-top");

    it("should start under the top bar, and follow it out of view as the page scrolls, so no gap shows above it", async () => {
      setWindowWidth(1280);
      const rect = pageTop(65);
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());
      expect(panelTop()).toBe("65px");

      rect.mockImplementation(() => ({ top: 20 }) as DOMRect);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(panelTop()).toBe("20px");

      rect.mockImplementation(() => ({ top: -400 }) as DOMRect);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(panelTop()).toBe("0px");
    });
  });

  describe("while a reply streams", () => {
    async function startStreamedReply(user: ReturnType<typeof userEvent.setup>) {
      const stream = controlledStream();
      panelBackend.answerTurn = () => stream.response;
      const app = await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      stream.push(turnEvent + eventText({ type: "text", delta: "First part" }));
      await screen.findByRole("group", { name: "Assistant: First part" });
      return { stream, app };
    }

    it("should not stop it when the page changes under the open panel", async () => {
      const user = userEvent.setup();
      const { stream, app } = await startStreamedReply(user);

      app.goTo("/train");
      stream.push(eventText({ type: "text", delta: " and more" }));

      expect(
        await screen.findByRole("group", { name: "Assistant: First part and more" }),
      ).toBeTruthy();
      expect(screen.queryByText(ASSISTANT_STOPPED.label)).toBeNull();
    });

    it("should not stop it when the window crosses the large breakpoint", async () => {
      const user = userEvent.setup();
      const { stream } = await startStreamedReply(user);

      resizeWindow(1280);
      expect(screen.getByRole("complementary", { name: ASSISTANT_SHEET.title })).toBeTruthy();
      stream.push(eventText({ type: "text", delta: " and more" }));

      expect(
        await screen.findByRole("group", { name: "Assistant: First part and more" }),
      ).toBeTruthy();
      expect(screen.queryByText(ASSISTANT_STOPPED.label)).toBeNull();
    });
  });

  describe("the empty state", () => {
    it("should show the diary's words, the starters and the not-medical line", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await openPanel(user);

      expect(screen.getByRole("heading", { name: ASSISTANT_SHEET.emptyHeading })).toBeTruthy();
      const starters = within(screen.getByRole("region", { name: ASSISTANT_SHEET.startersLabel }));
      expect(starters.getAllByRole("button").map((starter) => starter.textContent)).toEqual([
        ...ASSISTANT_SHEET.starters,
      ]);
      expect(screen.getByText(ASSISTANT_NOT_MEDICAL_ADVICE)).toBeTruthy();
      expect(field().getAttribute("placeholder")).toBe(ASSISTANT_SHEET.composerPlaceholder);
    });

    it("should show the training words when it is opened from a Train page", async () => {
      const user = userEvent.setup();
      await renderApp("/train/history");
      await openPanel(user);

      expect(
        screen.getByRole("heading", { name: ASSISTANT_TRAIN_SHEET.emptyHeading }),
      ).toBeTruthy();
      expect(field().getAttribute("placeholder")).toBe(ASSISTANT_TRAIN_SHEET.composerPlaceholder);
    });

    it("should say what Enter does under the field", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      expect(screen.getByText(ASSISTANT_SHEET.composerKeyboardHint)).toBeTruthy();
    });

    it("should stand in a loading placeholder until the conversation is read", async () => {
      let release = () => undefined;
      panelBackend.statusGate = new Promise((resolve) => {
        release = () => {
          resolve();
        };
      });
      const user = userEvent.setup();
      await renderApp();

      await user.click(assistantButton());

      expect(screen.getByRole("status", { name: ASSISTANT_SHEET.openingLabel })).toBeTruthy();
      release();
      await screen.findByRole("region", { name: ASSISTANT_SHEET.startersLabel });
      expect(screen.queryByRole("status", { name: ASSISTANT_SHEET.openingLabel })).toBeNull();
    });
  });

  describe("consent", () => {
    beforeEach(() => {
      panelBackend.isConsentGiven = false;
    });

    async function openOnConsent(user: ReturnType<typeof userEvent.setup>) {
      await user.click(assistantButton());
      await screen.findByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel });
    }

    it("should show the consent card, with no field, before the assistant is turned on", async () => {
      const user = userEvent.setup();
      await renderApp();

      await openOnConsent(user);

      expect(screen.getByText(ASSISTANT_CONSENT_CARD.title)).toBeTruthy();
      for (const paragraph of ASSISTANT_CONSENT_CARD.paragraphs) {
        expect(screen.getByText(paragraph)).toBeTruthy();
      }
      expect(screen.getByText(ASSISTANT_CONSENT_CARD.smallPrint)).toBeTruthy();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(
        screen
          .getByRole("button", { name: ASSISTANT_SHEET.newConversationLabel })
          .hasAttribute("disabled"),
      ).toBe(true);
    });

    it("should link to the Privacy policy in a new tab, so the conversation is not left", async () => {
      const user = userEvent.setup();
      await renderApp();

      await openOnConsent(user);

      const link = screen.getByRole("link", { name: ASSISTANT_CONSENT_CARD.privacyLinkLabel });
      expect(link.getAttribute("href")).toBe(LEGAL_PATHS.privacy);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("should close on Not now", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_CONSENT_CARD.notNowLabel }));

      expect(screen.queryByRole("dialog", { name: ASSISTANT_SHEET.title })).toBeNull();
    });

    it("should turn the assistant on with Turn on, and then show the empty state", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel }));

      await screen.findByRole("heading", { name: ASSISTANT_SHEET.emptyHeading });
      expect(panelBackend.isConsentGiven).toBe(true);
      expect(screen.queryByText(ASSISTANT_CONSENT_CARD.title)).toBeNull();
      expect(field()).toBeTruthy();
    });

    it("should say so in a toast at the top when turning it on fails, and keep the card", async () => {
      panelBackend.consentWriteFails = true;
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel }));

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(screen.getByText(ASSISTANT_CONSENT_CARD.title)).toBeTruthy();
      await waitFor(() => {
        expect(
          screen
            .getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel })
            .hasAttribute("disabled"),
        ).toBe(false);
      });
    });

    it("should not let Turn on be pressed offline, and say the assistant needs a connection", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openOnConsent(user);

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(ASSISTANT_OFFLINE.title)).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: ASSISTANT_CONSENT_CARD.turnOnLabel })
          .hasAttribute("disabled"),
      ).toBe(true);
    });
  });

  describe("sending", () => {
    it("should send a starter at once, and draw your message and the streamed answer", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      expect(await screen.findByRole("group", { name: "Assistant: Hello there" })).toBeTruthy();
      expect(
        screen.getByRole("group", {
          name: `${ASSISTANT_SHEET.speakerYou}: ${ASSISTANT_SHEET.starters[1]}`,
        }),
      ).toBeTruthy();
      expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual([
        ASSISTANT_SHEET.starters[1],
      ]);
      expect(screen.queryByRole("heading", { name: ASSISTANT_SHEET.emptyHeading })).toBeNull();
    });

    it("should send what is typed on Enter, and clear the field", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.type(field(), "What did I eat?{Enter}");

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual(["What did I eat?"]);
      expect((field() as HTMLTextAreaElement).value).toBe("");
    });

    it("should add a line on Shift and Enter and send nothing", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.type(field(), "first{Shift>}{Enter}{/Shift}second");

      expect((field() as HTMLTextAreaElement).value).toBe("first\nsecond");
      expect(panelBackend.turnRequests).toEqual([]);
    });

    it("should send with the Send button, which is off until there are words", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      expect(sendButton().hasAttribute("disabled")).toBe(true);

      await user.type(field(), "Hello");
      expect(sendButton().hasAttribute("disabled")).toBe(false);
      await user.click(sendButton());

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ text }) => text)).toEqual(["Hello"]);
    });

    it("should send on the day the diary is showing", async () => {
      viewedDate.mockReturnValue("2026-10-20");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ localDate }) => localDate)).toEqual(["2026-10-20"]);
    });

    it("should send on today in the profile's time zone when no day is on view", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-27T23:30:00Z"));
      panelBackend.timeZone = "Pacific/Auckland";
      const user = userEvent.setup({ advanceTimers: () => undefined });
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await screen.findByRole("group", { name: "Assistant: Hello there" });
      expect(panelBackend.turnRequests.map(({ localDate }) => localDate)).toEqual(["2026-10-28"]);
    });

    it("should turn the field and Send off offline, and say the assistant needs a connection", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(ASSISTANT_OFFLINE.title)).toBeTruthy();
      expect(screen.getByText(ASSISTANT_OFFLINE.body)).toBeTruthy();
      expect(sendButton().hasAttribute("disabled")).toBe(true);
      expect(field().hasAttribute("disabled")).toBe(true);
      expect(
        within(screen.getByRole("region", { name: ASSISTANT_SHEET.startersLabel }))
          .getAllByRole("button")
          .every(
            (starter) =>
              starter.hasAttribute("disabled") || starter.getAttribute("aria-disabled") === "true",
          ),
      ).toBe(true);
    });
  });

  describe("the answer", () => {
    it("should draw the reply's markdown as formatting", async () => {
      panelBackend.answerTurn = () =>
        turnResponse(replyEvents("You have **1,693 kcal** left, ", "so *plenty*."));
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await screen.findByRole("group", { name: "Assistant: You have 1,693 kcal left, so plenty." });
      expect(screen.getByText("1,693 kcal").tagName).toBe("STRONG");
      expect(screen.getByText("plenty").tagName).toBe("EM");
    });

    it("should show the step the assistant is on as the working line, and announce only the first step", async () => {
      panelBackend.answerTurn = () =>
        openTurnResponse(
          eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
            eventText({
              type: "status",
              code: "tool",
              tool: "search_foods",
              food: "toast",
              isConfirmed: false,
            }),
        );
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      // The line holds each step for 700 ms, then shows the next. A screen reader is told the first step on
      // mounting and the later ones only after 5 seconds, so it hears one step here.
      await screen.findByText("Looking up toast", undefined, { timeout: 3000 });
      expect(screen.getAllByText("Thinking")).toHaveLength(1);
      expect(screen.getAllByText("Looking up toast")).toHaveLength(1);
    });

    it("should announce the finished answer once, in a polite live region, and not while it streams", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));

      await waitFor(() => {
        expect(
          screen.getAllByRole("status").filter((region) => region.textContent === "Hello there"),
        ).toHaveLength(1);
      });
      const region = screen
        .getAllByRole("status")
        .filter((candidate) => candidate.textContent === "Hello there")[0];
      expect(region?.getAttribute("aria-live")).toBe("polite");
    });

    it("should keep a reply that was cut short by closing the panel, marked stopped", async () => {
      panelBackend.answerTurn = () => stoppedStream("Yesterday you logged 8 entries");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      await screen.findByRole("group", { name: "Assistant: Yesterday you logged 8 entries" });

      await user.click(within(panel()).getByRole("button", { name: ASSISTANT_SHEET.closeLabel }));
      await user.click(assistantButton());

      expect(
        await screen.findByRole("group", {
          name: `Assistant: Yesterday you logged 8 entries ${ASSISTANT_STOPPED.label}`,
        }),
      ).toBeTruthy();
    });

    it("should stop a reply that is arriving when the top bar's button closes the panel", async () => {
      panelBackend.answerTurn = () => stoppedStream("Yesterday you logged 8 entries");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      await screen.findByRole("group", { name: "Assistant: Yesterday you logged 8 entries" });

      await user.click(assistantButton());
      await user.click(assistantButton());

      expect(
        await screen.findByRole("group", {
          name: `Assistant: Yesterday you logged 8 entries ${ASSISTANT_STOPPED.label}`,
        }),
      ).toBeTruthy();
    });

    it("should leave the field on and Send off while an answer arrives", async () => {
      panelBackend.answerTurn = () => stoppedStream("Yesterday");
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      await screen.findByRole("group", { name: "Assistant: Yesterday" });

      await user.type(field(), "next");

      expect(field().hasAttribute("disabled")).toBe(false);
      expect(sendButton().hasAttribute("disabled")).toBe(true);
    });
  });

  describe("a new conversation", () => {
    it("should be off while the conversation is empty", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);

      expect(
        screen
          .getByRole("button", { name: ASSISTANT_SHEET.newConversationLabel })
          .hasAttribute("disabled"),
      ).toBe(true);
    });

    it("should start a new conversation and show the empty state again", async () => {
      panelBackend.storedTurns = [{ userText: "What's left?", assistantText: "1,693 kcal left." }];
      const user = userEvent.setup();
      await renderApp();
      await user.click(assistantButton());
      await screen.findByRole("group", { name: "Assistant: 1,693 kcal left." });

      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.newConversationLabel }));

      await screen.findByRole("heading", { name: ASSISTANT_SHEET.emptyHeading });
      expect(panelBackend.newConversationRequests).toBe(1);
    });
  });

  describe("following the end of the thread", () => {
    // jsdom has no layout, so the thread is 1000 tall in a 400 window, and every write to its scroll position is kept.
    const sizeThread = (thread: HTMLElement) => {
      let top = 0;
      const writes: number[] = [];
      Object.defineProperties(thread, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 400 },
        scrollTop: {
          configurable: true,
          get: () => top,
          set: (next: number) => {
            top = next;
            writes.push(next);
          },
        },
      });
      // The person's own scroll moves the thread and says so, and is not one of the panel's writes.
      const scrollUpTo = (next: number) => {
        top = next;
        act(() => {
          thread.dispatchEvent(new Event("scroll"));
        });
      };
      return { writes, scrollUpTo };
    };

    it("should scroll to the end as the thread grows", async () => {
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      const { writes } = sizeThread(screen.getByRole("log"));

      await user.type(field(), "Hello{Enter}");
      await screen.findByRole("group", { name: "Assistant: Hello there" });

      expect(writes.at(-1)).toBe(1000);
    });

    it("should leave a person who scrolled up while the answer grows where they are", async () => {
      const stream = controlledStream();
      panelBackend.answerTurn = () => stream.response;
      const user = userEvent.setup();
      await renderApp();
      await openPanel(user);
      const thread = screen.getByRole("log");
      const { writes, scrollUpTo } = sizeThread(thread);
      await user.click(screen.getByRole("button", { name: ASSISTANT_SHEET.starters[1] }));
      stream.push(turnEvent + eventText({ type: "text", delta: "First part" }));
      await screen.findByRole("group", { name: "Assistant: First part" });

      scrollUpTo(100);
      const writesBefore = writes.length;
      stream.push(eventText({ type: "text", delta: " and more" }));
      await screen.findByRole("group", { name: "Assistant: First part and more" });

      expect(writes).toHaveLength(writesBefore);
    });
  });
});
