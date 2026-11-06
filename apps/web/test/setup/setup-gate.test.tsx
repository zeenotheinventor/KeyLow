import { KeyLowProvider, keys, useSaveSetup } from "@keylow/api-client";
import { startingPlan } from "@keylow/core/setup";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetSetupBackend,
  savedProfile,
  setupBackend,
  signInSetupClient,
  setupClient,
} from "./support";

import { SetupGate } from "@/app/(dashboard)/SetupGate";

const navigation = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    pathname: "/dashboard",
    listeners,
    replace: vi.fn<(href: string) => void>(),
    /** Moves the address and tells whoever is reading it, as the router does. */
    moveTo(address: string) {
      navigation.pathname = address.split("?")[0] ?? address;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
});
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRouter: () => ({ replace: navigation.replace }),
    usePathname: () =>
      useSyncExternalStore(
        (listener) => {
          navigation.listeners.add(listener);
          return () => navigation.listeners.delete(listener);
        },
        () => navigation.pathname,
      ),
  };
});

const FIRST_RUN = "/setup?mode=first-run";
const NOT_SET_UP = { ...savedProfile, onboarding_completed_at: null };

let queryClient: QueryClient;

/** The page as the app draws it: the gate, and whatever the person is on. */
function Page({ children }: { children?: React.ReactNode }) {
  return (
    <KeyLowProvider client={setupClient} queryClient={queryClient}>
      <SetupGate />
      {children}
    </KeyLowProvider>
  );
}

/** The person moves to another address, as a link does. */
function goTo(address: string) {
  act(() => {
    navigation.moveTo(address);
  });
}

async function openAt(pathname: string, children?: React.ReactNode) {
  navigation.pathname = pathname;
  await signInSetupClient();
  render(<Page>{children}</Page>);
}

// A real signal that the gate's read has finished: the request reached the database, and the query is idle.
async function untilTheReadHasFinished() {
  await waitFor(() => {
    expect(setupBackend.reads).toBeGreaterThan(0);
  });
  await waitFor(() => {
    expect(queryClient.getQueryState(keys.profiles.setupState)?.fetchStatus).toBe("idle");
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the first run setup gate", () => {
  beforeEach(() => {
    resetSetupBackend();
    navigation.replace.mockReset();
    navigation.replace.mockImplementation((address) => {
      navigation.moveTo(address);
    });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    cleanup();
    queryClient.clear();
  });

  describe("an account that is not set up", () => {
    it.each(["/dashboard", "/diary", "/train", "/more"])(
      "should be sent from %s to the first run, with a replace",
      async (pathname) => {
        setupBackend.profile = NOT_SET_UP;

        await openAt(pathname);

        await waitFor(() => {
          expect(navigation.replace).toHaveBeenCalledExactlyOnceWith(FIRST_RUN);
        });
      },
    );

    it("should draw nothing of its own", async () => {
      setupBackend.profile = NOT_SET_UP;
      await openAt("/more/targets");
      await untilTheReadHasFinished();

      expect(document.body.textContent).toBe("");
    });

    it.each([
      "/more/targets",
      "/more/targets/",
      "/foods/some-food",
      "/diary/2026-11-06",
      "/diary/",
      "/train/session",
      "/recipes",
      "/weight",
      "/goal",
      "/body-map",
      "/about",
    ])("should not send a person who is on %s", async (pathname) => {
      setupBackend.profile = NOT_SET_UP;
      await openAt(pathname);
      await untilTheReadHasFinished();

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it.each(["/setup", "/setup/body", "/setup/estimate"])(
      "should never send a person who is on the wizard at %s",
      async (pathname) => {
        setupBackend.profile = NOT_SET_UP;
        await openAt(pathname);
        await untilTheReadHasFinished();

        expect(navigation.replace).not.toHaveBeenCalled();
      },
    );

    it("should send a person on the Diary at a date, which the pathname gives as /diary", async () => {
      setupBackend.profile = NOT_SET_UP;

      await openAt("/diary");

      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalledExactlyOnceWith(FIRST_RUN);
      });
    });

    it("should not send them a second time while the page stays loaded", async () => {
      setupBackend.profile = NOT_SET_UP;
      await openAt("/dashboard");
      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalledOnce();
      });

      goTo("/diary");
      goTo("/train");
      await untilTheReadHasFinished();

      expect(navigation.replace).toHaveBeenCalledOnce();
    });

    it("should not send a person who opened the wizard by a link and left it for the Diary", async () => {
      setupBackend.profile = NOT_SET_UP;
      await openAt("/setup");
      await untilTheReadHasFinished();

      goTo("/diary");
      await untilTheReadHasFinished();

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should not send a person who arrived deep in the wizard and left it for the Diary", async () => {
      setupBackend.profile = NOT_SET_UP;
      await openAt("/setup/estimate");
      await untilTheReadHasFinished();

      goTo("/diary");
      await untilTheReadHasFinished();

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should send them again on a new page load", async () => {
      setupBackend.profile = NOT_SET_UP;
      await openAt("/dashboard");
      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalledOnce();
      });
      cleanup();
      queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      await openAt("/diary");

      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("failing open", () => {
    it("should not send an account that is set up", async () => {
      setupBackend.profile = savedProfile;
      await openAt("/diary");
      await untilTheReadHasFinished();

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should not send an account with no profile row, which reads as set up", async () => {
      setupBackend.profile = null;
      await openAt("/diary");
      await untilTheReadHasFinished();

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should not send anyone when the read fails", async () => {
      setupBackend.profile = NOT_SET_UP;
      setupBackend.status = "error";
      await openAt("/diary");
      await waitFor(() => {
        expect(queryClient.getQueryState(keys.profiles.setupState)?.status).toBe("error");
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should not send anyone when a read fails after one that said not set up, with its data kept", async () => {
      setupBackend.profile = NOT_SET_UP;
      await openAt("/more/targets");
      await untilTheReadHasFinished();
      setupBackend.status = "error";

      await act(async () => {
        await queryClient.refetchQueries({ queryKey: keys.profiles.setupState });
      });
      await waitFor(() => {
        expect(queryClient.getQueryState(keys.profiles.setupState)?.status).toBe("error");
      });
      expect(queryClient.getQueryData(keys.profiles.setupState)).toMatchObject({ isSetUp: false });
      goTo("/diary");
      await act(async () => {
        await Promise.resolve();
      });

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should not send anyone while the read is under way", async () => {
      setupBackend.profile = NOT_SET_UP;
      setupBackend.status = "pending";
      await openAt("/diary");
      await waitFor(() => {
        expect(setupBackend.reads).toBeGreaterThan(0);
      });
      expect(queryClient.getQueryState(keys.profiles.setupState)?.fetchStatus).toBe("fetching");
      await act(async () => {
        await Promise.resolve();
      });

      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should not send anyone offline with nothing cached", async () => {
      setupBackend.profile = NOT_SET_UP;
      onlineManager.setOnline(false);
      await openAt("/diary");
      await waitFor(() => {
        expect(queryClient.getQueryState(keys.profiles.setupState)?.fetchStatus).toBe("paused");
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(setupBackend.reads).toBe(0);
      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("should not trust another account's answer left in the cache while the read is under way", async () => {
      queryClient.setQueryData(keys.profiles.setupState, {
        isSetUp: false,
        stats: {},
        program: null,
        latestWeighIn: null,
      });
      setupBackend.profile = savedProfile;
      setupBackend.status = "pending";

      await openAt("/diary");
      await waitFor(() => {
        expect(queryClient.getQueryState(keys.profiles.setupState)?.fetchStatus).toBe("fetching");
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(navigation.replace).not.toHaveBeenCalled();
    });
  });

  describe("after the real save", () => {
    function SaveButton() {
      const saveSetup = useSaveSetup();
      const { save } = startingPlan(
        {
          sex: "male",
          birthDate: "1991-03-14",
          heightCm: 180,
          weightKg: 80,
          weightUnit: "kg",
          heightUnit: "cm",
          activity: "light",
          goal: "maintain",
          ratePctPerWeek: 0,
          proteinPreset: "moderate",
          dietStyle: "balanced",
        },
        "2026-11-06",
        null,
      );
      return (
        <button
          type="button"
          onClick={() => {
            void saveSetup
              .mutateAsync({ save, latestWeighInKg: null, timeZone: "UTC" })
              .then(() => {
                navigation.replace("/diary");
              });
          }}
        >
          Start
        </button>
      );
    }

    it("should not send a new account back to the wizard it has just finished", async () => {
      setupBackend.profile = NOT_SET_UP;
      await openAt("/dashboard", <SaveButton />);
      await waitFor(() => {
        expect(navigation.pathname).toBe("/setup");
      });
      await untilTheReadHasFinished();
      setupBackend.profile = savedProfile;
      const readsBefore = setupBackend.reads;

      await userEvent.click(screen.getByRole("button", { name: "Start" }));
      await waitFor(() => {
        expect(navigation.pathname).toBe("/diary");
      });
      await waitFor(() => {
        expect(setupBackend.reads).toBeGreaterThan(readsBefore);
      });
      await untilTheReadHasFinished();

      expect(navigation.replace.mock.calls.map(([address]) => address)).toEqual([
        FIRST_RUN,
        "/diary",
      ]);
    });
  });
});
