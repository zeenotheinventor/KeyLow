import { KeyLowProvider, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";

import { SetupGate } from "../components/SetupGate";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  freshProfile,
  resetSetupBackend,
  savedProfile,
  setupBackend,
  setupClient,
  setupReads,
} from "./support/setupBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const FIRST_RUN_SETUP = "/setup?mode=first-run";

let queryClient: QueryClient;

const gate = () => (
  <KeyLowProvider client={setupClient} queryClient={queryClient}>
    <SetupGate />
  </KeyLowProvider>
);

async function renderGate(segments: string[] = ["(tabs)", "diary"]) {
  routerMock.segments = segments;
  await render(gate());
}

// The gate's own read has settled once the setup state has been asked for and has an answer.
async function untilSetupStateIsRead() {
  await waitFor(() => {
    expect(setupReads().map((request) => request.table)).toContain("profiles");
  });
  await waitFor(() => {
    expect(queryClient.getQueryState(keys.profiles.setupState)?.fetchStatus).toBe("idle");
  });
}

async function moveTo(segments: string[]) {
  routerMock.segments = segments;
  await act(async () => {
    await screen.rerender(gate());
  });
}

describe("the first run setup gate", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSetupBackend();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    await cleanup();
    queryClient.clear();
  });

  describe("an account that is not set up", () => {
    it("should be sent from the tabs to the first run setup", async () => {
      await renderGate();

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith(FIRST_RUN_SETUP);
      });
    });

    it("should draw nothing of its own", async () => {
      await renderGate();
      await untilSetupStateIsRead();

      expect(screen.toJSON()).toBeNull();
    });

    it("should wait for the Terms to be accepted before it reads or sends anyone anywhere", async () => {
      setupBackend.hasAcceptedTerms = false;

      await renderGate();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(setupReads()).toEqual([]);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("an account that is set up", () => {
    it("should not be sent anywhere", async () => {
      setupBackend.profile = savedProfile;

      await renderGate();
      await untilSetupStateIsRead();

      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("when the setup state cannot be known", () => {
    it("should do nothing when the read fails", async () => {
      setupBackend.readsFail = true;

      await renderGate();
      await waitFor(() => {
        expect(queryClient.getQueryState(keys.profiles.setupState)?.status).toBe("error");
      });

      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(screen.toJSON()).toBeNull();
    });

    it("should do nothing when the phone is offline and no setup state is cached", async () => {
      // The acceptance is cached, as the phone keeps it, so the reads are allowed and only the setup state is missing.
      queryClient.setQueryData(keys.profiles.termsAcceptance, {
        terms_accepted_at: "2026-10-15T09:30:00+00:00",
        terms_version: TERMS_VERSION,
      });
      onlineManager.setOnline(false);

      await renderGate();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(setupReads()).toEqual([]);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should not act on an answer cached for someone else while the account's own is read", async () => {
      // Signing out and in as another account in one launch leaves the last account's answer in the cache.
      queryClient.setQueryData(keys.profiles.setupState, { isSetUp: false });
      setupBackend.profile = savedProfile;
      let release: () => void = () => undefined;
      setupBackend.readGate = new Promise<void>((resolve) => {
        release = resolve;
      });

      await renderGate();
      await waitFor(() => {
        expect(queryClient.getQueryState(keys.profiles.setupState)?.fetchStatus).toBe("fetching");
      });
      expect(routerMock.replace).not.toHaveBeenCalled();

      release();
      await untilSetupStateIsRead();

      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("once per launch", () => {
    it("should send the account once, however often the tabs come back into view", async () => {
      await renderGate();
      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledTimes(1);
      });

      await moveTo(["setup"]);
      await moveTo(["(tabs)", "dashboard"]);
      await moveTo(["(tabs)", "diary"]);

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
    });

    it("should not send the account again when the setup state is read again and still says not set up", async () => {
      await renderGate();
      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: keys.profiles.setupState });
      });
      await moveTo(["(tabs)", "dashboard"]);

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
    });

    it("should send an account that signs in later in the launch, which is a new gate", async () => {
      await renderGate();
      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledTimes(1);
      });

      await screen.unmount();
      resetSetupBackend();
      setupBackend.profile = freshProfile;
      await render(gate());

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("only from the tabs", () => {
    it.each([
      ["a modal the person opened", ["foods", "search"]],
      ["the root route before it has redirected", []],
      ["the setup wizard itself", ["setup"]],
    ])("should not send an account over %s", async (_name, segments) => {
      await renderGate(segments);
      await untilSetupStateIsRead();

      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should send the account when it comes back to the tabs from a modal", async () => {
      await renderGate(["foods", "search"]);
      await untilSetupStateIsRead();

      await moveTo(["(tabs)", "diary"]);

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).toHaveBeenCalledWith(FIRST_RUN_SETUP);
    });
  });
});
