import { KeyLowProvider } from "@keylow/api-client";
import { widgetSnapshotSchema, buildWidgetSnapshot } from "@keylow/core/widgets";
import { createClient } from "@supabase/supabase-js";
import { cleanup, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";

import { useWidgetSnapshotSource } from "./useWidgetSnapshotSource";
import { createDiaryQueryClient } from "../../test/support/diaryBackend";
import { resetRouterMock } from "../../test/support/expoRouterMock";
import { legsRoutine, goldenLegsOpen } from "../../test/support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend, trainFetch } from "../../test/support/trainBackend";
import { installVirtualClock } from "../../test/support/virtualClock";
import { NONCE } from "../../test/support/widgetFixtures";

import type { WidgetSnapshotSource } from "./snapshotWriter";
import type { Database } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () =>
    jest.requireActual<{ mockExpoRouter: unknown }>("../../test/support/expoRouterMock")
      .mockExpoRouter,
);

// The weigh-ins are not in the training fake, so they are answered here: none.
const fetchWithWeighIns: typeof fetch = (input, init) => {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return address.includes("/weigh_ins")
    ? Promise.resolve(
        new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
      )
    : trainFetch(input, init);
};
const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithWeighIns },
});

const NOW = new Date("2026-10-15T16:55:00Z");

let latest: WidgetSnapshotSource | null = null;
let queryClient: QueryClient;

function Probe({ onSource }: { onSource: (source: WidgetSnapshotSource | null) => void }) {
  const source = useWidgetSnapshotSource(NOW);
  useEffect(() => {
    onSource(source);
  }, [source, onSource]);
  return null;
}

const remember = (source: WidgetSnapshotSource | null) => {
  latest = source;
};

describe("useWidgetSnapshotSource", () => {
  beforeEach(() => {
    installVirtualClock({ now: NOW });
    resetRouterMock();
    resetTrainBackend();
    latest = null;
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  it("should give what the widgets need once every read has answered, as a snapshot the schema accepts", async () => {
    queryClient = createDiaryQueryClient();
    await render(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <Probe onSource={remember} />
      </KeyLowProvider>,
    );

    await waitFor(() => {
      expect(latest).not.toBeNull();
    });
    const snapshot =
      latest === null ? null : buildWidgetSnapshot({ ...latest, nonce: NONCE, now: NOW });
    expect(widgetSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot?.training.session).not.toBeNull();
  });

  it("should give the same source object while nothing it is made of changes", async () => {
    queryClient = createDiaryQueryClient();
    const sources: (WidgetSnapshotSource | null)[] = [];
    const element = () => (
      <KeyLowProvider client={client} queryClient={queryClient}>
        <Probe
          onSource={(source) => {
            sources.push(source);
          }}
        />
      </KeyLowProvider>
    );
    const view = await render(element());
    await waitFor(() => {
      expect(sources.at(-1)).not.toBeNull();
    });
    const settled = sources.at(-1);

    await view.rerender(element());
    await view.rerender(element());

    expect(sources.at(-1)).toBe(settled);
  });
});
