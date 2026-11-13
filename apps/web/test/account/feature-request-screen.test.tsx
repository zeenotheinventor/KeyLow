import { KeyLowProvider } from "@keylow/api-client";
import { FEATURE_REQUEST_SCREEN, describeFeatureRequestLength } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../ui/appRouter";

import { FeatureRequestScreen } from "@/components/account";
import { ToastProvider } from "@/components/ui/Toast";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn<(href: string) => void>(), replace: vi.fn<(href: string) => void>() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const copy = FEATURE_REQUEST_SCREEN;

// The database as the screen's real Supabase client meets it: every request is answered here, so what the
// screen sends is what is checked, not what a hook was called with.
type Answer = "saved" | "dailyLimit" | "failed" | "held";
const database = {
  answer: "saved" as Answer,
  inserts: [] as unknown[],
  held: [] as Array<() => void>,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function answerInsert(): Promise<Response> {
  switch (database.answer) {
    case "saved":
      return Promise.resolve(json({ id: "22222222-2222-4222-8222-222222222222" }, 201));
    case "dailyLimit":
      return Promise.resolve(
        json(
          { code: "54000", message: "feature_requests_daily_cap", details: null, hint: null },
          400,
        ),
      );
    case "failed":
      return Promise.resolve(
        json({ code: "XX000", message: "database unavailable", details: null, hint: null }, 500),
      );
    case "held":
      return new Promise((resolve) => {
        database.held.push(() => {
          resolve(json({ id: "22222222-2222-4222-8222-222222222222" }, 201));
        });
      });
  }
}

async function fakeFetch(input: string | URL | globalThis.Request, init?: RequestInit) {
  const request = new globalThis.Request(input, init);
  const text = await request.text();
  if (new URL(request.url).pathname.endsWith("/feature_requests") && request.method === "POST") {
    database.inserts.push(JSON.parse(text));
    return answerInsert();
  }
  return json({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

function renderScreen() {
  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={new QueryClient()}>
      <ToastProvider>
        <FeatureRequestScreen />
      </ToastProvider>
    </KeyLowProvider>,
  );
}

const field = () => screen.getByRole("textbox", { name: copy.fieldLabel });
const sendButton = () => screen.getByRole("button", { name: copy.send });

async function typeRequest(text: string) {
  const user = userEvent.setup();
  await user.click(field());
  await user.paste(text);
  return user;
}

beforeEach(() => {
  database.answer = "saved";
  database.inserts = [];
  database.held = [];
  router.push.mockReset();
  router.replace.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Request a feature screen", () => {
  it("should say where the request goes, under a title and a way back to More", () => {
    renderScreen();

    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.back }).getAttribute("href")).toBe("/more");
    expect(screen.getByText(copy.explainer)).toBeTruthy();
  });

  it("should have Send off and the count at nought until something is typed", () => {
    renderScreen();

    expect(sendButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(describeFeatureRequestLength(""))).toBeTruthy();
  });

  it("should keep Send off under three characters and turn it on at three", async () => {
    renderScreen();

    await typeRequest("ab ");
    expect(sendButton().hasAttribute("disabled")).toBe(true);

    await typeRequest("c");
    expect(sendButton().hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(describeFeatureRequestLength("ab c"))).toBeTruthy();
  });

  it("should keep Send off and say so over 1,000 characters, and turn it on at 1,000", async () => {
    renderScreen();

    await typeRequest("a".repeat(1001));
    expect(sendButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(copy.tooLong)).toBeTruthy();
    expect(field().getAttribute("aria-invalid")).toBe("true");

    cleanup();
    renderScreen();
    await typeRequest("a".repeat(1000));
    expect(sendButton().hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(copy.tooLong)).toBeNull();
  });

  it("should write one request from the More menu, then thank at the top and go back to More", async () => {
    renderScreen();
    const user = await typeRequest("  Let me copy a whole day  ");

    await user.click(sendButton());

    await waitFor(() => {
      expect(screen.getByText(copy.sentToast)).toBeTruthy();
    });
    expect(database.inserts).toHaveLength(1);
    expect(database.inserts[0]).toMatchObject({
      source: "more_menu",
      request: "Let me copy a whole day",
    });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/more");
  });

  it("should show Send as sending and send nothing more while the request is on its way", async () => {
    database.answer = "held";
    renderScreen();
    const user = await typeRequest("Let me copy a whole day");

    await user.click(sendButton());

    const sending = await screen.findByRole("button", { name: "Loading" });
    expect(sending.getAttribute("aria-busy")).toBe("true");
    expect(sending.hasAttribute("disabled")).toBe(true);
    await user.click(sending);
    expect(database.inserts).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();

    await act(async () => {
      database.held.forEach((release) => {
        release();
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/more");
    });
  });

  it("should say the daily limit is reached in its own words and keep the text", async () => {
    database.answer = "dailyLimit";
    renderScreen();
    const user = await typeRequest("Let me copy a whole day");

    await user.click(sendButton());

    expect(await screen.findByText(copy.dailyLimit.title)).toBeTruthy();
    expect(screen.getByText(copy.dailyLimit.body)).toBeTruthy();
    expect(screen.queryByText(copy.failed.title)).toBeNull();
    expect(field()).toHaveProperty("value", "Let me copy a whole day");
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByText(copy.sentToast)).toBeNull();
  });

  it("should say the request was not sent for any other failure, keep the text and allow another go", async () => {
    database.answer = "failed";
    renderScreen();
    const user = await typeRequest("Let me copy a whole day");

    await user.click(sendButton());

    expect(await screen.findByText(copy.failed.title)).toBeTruthy();
    expect(screen.queryByText(copy.dailyLimit.title)).toBeNull();
    expect(field()).toHaveProperty("value", "Let me copy a whole day");
    expect(sendButton().hasAttribute("disabled")).toBe(false);

    database.answer = "saved";
    await user.click(sendButton());
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/more");
    });
    expect(database.inserts).toHaveLength(2);
  });
});
