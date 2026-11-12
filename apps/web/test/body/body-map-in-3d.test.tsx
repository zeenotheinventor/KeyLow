import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP, MUSCLE_NAMES } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderIn,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubWebGL } from "../support/webgl";

import type { Body3DProps } from "@/components/ui/Body3D";
import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { resetBody3DSupportForTests } from "@/components/body/BodyView/testing";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";
import { resetBodyMapRendererForTests } from "@/lib/bodyMapRenderer/testing";

// jsdom has no WebGL, so the 3D body is stood in for. The tests say when it has drawn, held a muscle or zoomed.
const body3D = vi.hoisted((): { latest: Body3DProps | null } => ({ latest: null }));

vi.mock("@/components/ui/Body3D", () => {
  return {
    Body3D: (props: Body3DProps) => {
      body3D.latest = props;
      return <div role="img" aria-label={props.label} />;
    },
  };
});

// The renderer is read at once in a browser, so a test says when it is not yet known, as the server's first draw has it.
const renderer = vi.hoisted(() => ({ isHeldBack: false }));

vi.mock("@/lib/bodyMapRenderer", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/bodyMapRenderer")>();
  return {
    ...original,
    useBodyMapRenderer: () => {
      const read = original.useBodyMapRenderer();
      return { ...read, isReady: read.isReady && !renderer.isHeldBack };
    },
  };
});

const reads = vi.hoisted(
  (): {
    byRead: Record<string, unknown>;
    asked: { view: string; scale: string; at: string | undefined }[];
  } => ({ byRead: {}, asked: [] }),
);

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
  useBodyMap: ({ view, scale, at }: { view: string; scale: string; at?: string | undefined }) => {
    reads.asked.push({ view, scale, at });
    return reads.byRead[`${scale}:${view}`];
  },
  useMuscleDetail: () => pending,
  useActiveRoutine: () => ({ data: null }),
  useMuscleList: () => pending,
  useMuscleScaleList: () => pending,
}));

const render = (ui: ReactElement) => renderIn(ui, { wrapper: ToastProvider });

const refetch = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
const read = <Data,>(data: Data): TrainingReadResult<Data> => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch,
});
const pending = {
  data: undefined,
  isPending: true,
  isError: false,
  error: null,
  refetch,
};

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";
const dayOf = (date: string, status: BodyMapDay["status"], plannedDayName: string): BodyMapDay => ({
  date,
  at: `${date}T19:00:00.000Z`,
  isToday: date === "2026-10-15",
  status,
  plannedDayName,
  sessionDayName: status === "logged" ? plannedDayName : null,
  selectable: true,
});
const actual: BodyMap = {
  values: { ...RESTING_HEAT, chest_upper: 1, quads: 3 },
  computedAt: THURSDAY_19_00,
  days: [
    dayOf("2026-10-12", "logged", "Push"),
    dayOf("2026-10-14", "rest", ""),
    dayOf("2026-10-15", "logged", "Legs"),
    dayOf("2026-10-17", "planned", "Push"),
  ],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};
const projected: BodyMap = { ...actual, values: { ...actual.values, lats: 5 } };
const volume: BodyMap = { ...actual, values: { ...RESTING_HEAT, quads: 2 } };

// The 3D body is read through import(), so it is given the time that takes before it is said not to be there.
async function settle() {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
}

const sideShown = (side: "Front" | "Back") => screen.getByRole("radio", { name: side });
const zoomGroup = () => screen.queryByRole("group", { name: BODY_MAP.zoom.groupName });
const toggle = () => screen.getByRole("button", { name: /^Show (projected|actual)$/ });

function latestBody3D(): Body3DProps {
  if (body3D.latest === null) {
    throw new Error("The 3D body was not drawn.");
  }
  return body3D.latest;
}

async function openIn3D() {
  window.localStorage.setItem("bodyMap.renderer", "3d");
  render(<BodyMapScreen />);
  await waitFor(() => {
    expect(body3D.latest).not.toBeNull();
  });
  act(() => {
    latestBody3D().onFirstFrame?.();
  });
}

describe("the body map page in 3D", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.figure", "male");
    // The first-open hint was dismissed on an earlier visit, so only its own tests see it.
    window.localStorage.setItem("bodyMap.hintSeen", "true");
    resetBodyFigureForTests();
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    onlineManager.setOnline(true);
    body3D.latest = null;
    renderer.isHeldBack = false;
    reads.asked = [];
    reads.byRead = {
      "heat:actual": read(actual),
      "heat:projected": read(projected),
      "volume:actual": read(volume),
      "volume:projected": read(volume),
      "gap:actual": read(actual),
    };
    stubWebGL({ available: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("on 2D, which is where a new browser starts", () => {
    it("should draw the front and the back together and never draw the 3D body", async () => {
      render(<BodyMapScreen />);
      await settle();

      // With a hold handler each figure is a group of muscle buttons.
      expect(
        screen.getAllByRole("group", { name: /^Body map, Actual, heat, (front|back)/ }),
      ).toHaveLength(2);
      expect(zoomGroup()).toBeNull();
      expect(body3D.latest).toBeNull();
    });

    it("should stay 2D with 3D chosen and the female figure, and not draw the 3D body", async () => {
      window.localStorage.setItem("bodyMap.renderer", "3d");
      window.localStorage.setItem("bodyMap.figure", "female");
      resetBodyFigureForTests();

      render(<BodyMapScreen />);
      await settle();

      expect(zoomGroup()).toBeNull();
      expect(body3D.latest).toBeNull();
    });

    it("should stay 2D with 3D chosen and no WebGL, and not draw the 3D body", async () => {
      stubWebGL({ available: false });
      window.localStorage.setItem("bodyMap.renderer", "3d");

      render(<BodyMapScreen />);
      await settle();

      expect(zoomGroup()).toBeNull();
      expect(body3D.latest).toBeNull();
    });
  });

  describe("before the renderer is known", () => {
    it("should draw neither layout until it is, so a person with 3D saved never sees the 2D one first", async () => {
      window.localStorage.setItem("bodyMap.renderer", "3d");
      renderer.isHeldBack = true;

      const { rerender } = render(<BodyMapScreen />);
      await settle();

      expect(screen.queryByRole("region", { name: BODY_MAP.title })).toBeNull();
      expect(screen.queryAllByRole("group", { name: /^Body map, Actual, heat/ })).toEqual([]);
      expect(body3D.latest).toBeNull();

      renderer.isHeldBack = false;
      rerender(<BodyMapScreen />);

      expect(screen.getByRole("region", { name: BODY_MAP.title })).toBeTruthy();
      await waitFor(() => {
        expect(body3D.latest).not.toBeNull();
      });
      expect(screen.queryAllByRole("group", { name: /^Body map, Actual, heat, back/ })).toEqual([]);
    });
  });

  describe("on 3D", () => {
    it("should draw one body on the stage, with Front and Back, the zoom buttons and the hint", async () => {
      await openIn3D();

      expect(screen.getAllByRole("img", { name: /^Body map, Actual, heat, front/ })).toHaveLength(
        1,
      );
      expect(screen.getByRole("radiogroup", { name: BODY_MAP.sideSwitch.name })).toBeTruthy();
      expect(zoomGroup()).toBeTruthy();
      expect(screen.getByText(BODY_MAP.rotateHintWeb)).toBeTruthy();
      expect(latestBody3D().values).toMatchObject({ quads: 3 });
    });

    it("should follow the Front and Back control, and the control follows a turn of the body", async () => {
      await openIn3D();

      fireEvent.click(sideShown("Back"));
      expect(latestBody3D().side).toBe("back");

      act(() => {
        latestBody3D().onSideChange?.("front");
      });
      expect(sideShown("Front")).toHaveProperty("checked", true);
    });

    it("should switch to Projected on a tap of the body, as a click on the 2D figures does", async () => {
      await openIn3D();

      act(() => {
        latestBody3D().onTap?.();
      });

      expect(toggle().textContent).toBe(BODY_MAP.toggle.showActual);
      expect(latestBody3D().values).toMatchObject({ lats: 5 });
    });

    it("should follow the scale, drawing Volume's values", async () => {
      await openIn3D();

      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.volume }));

      expect(latestBody3D().scale).toBe("volume");
      expect(latestBody3D().values).toMatchObject({ quads: 2 });
    });

    it("should do nothing on a tap on Gap, which has no other view, and still open the sheet on a hold", async () => {
      await openIn3D();
      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.gap }));

      expect(latestBody3D().onTap).toBeUndefined();
      expect(screen.queryByRole("button", { name: /^Show (projected|actual)$/ })).toBeNull();

      act(() => {
        latestBody3D().onLongPressMuscle?.("abs");
      });
      expect(screen.getByRole("dialog", { name: MUSCLE_NAMES.abs })).toBeTruthy();
    });

    it("should open the sheet for the muscle held, outline it, and close on Escape", async () => {
      await openIn3D();

      act(() => {
        latestBody3D().onLongPressMuscle?.("abs");
      });

      expect(screen.getByRole("dialog", { name: MUSCLE_NAMES.abs })).toBeTruthy();
      expect(latestBody3D().selected).toBe("abs");
      expect(latestBody3D().unselectedOpacity).toBeLessThan(1);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(latestBody3D().selected).toBeUndefined();
    });

    it("should read the body at the day picked in the scrubber", async () => {
      await openIn3D();
      reads.asked = [];

      fireEvent.click(
        within(screen.getByRole("radiogroup", { name: "Day shown" })).getByRole("radio", {
          name: /^Wednesday 14 October/,
        }),
      );

      expect(reads.asked).toContainEqual({ view: "actual", scale: "heat", at: "2026-10-14" });
    });

    it("should leave the first-open hint out, since the body has its own hint line", async () => {
      window.localStorage.removeItem("bodyMap.hintSeen");

      await openIn3D();

      expect(zoomGroup()).toBeTruthy();
      expect(screen.getByText(BODY_MAP.rotateHintWeb)).toBeTruthy();
      expect(screen.queryByText(BODY_MAP.coachMark.textWeb)).toBeNull();
      expect(screen.queryByRole("button", { name: BODY_MAP.coachMark.dismiss })).toBeNull();
    });

    it("should draw side by side in 2D, and the body again when it is turned off", async () => {
      await openIn3D();

      fireEvent.click(screen.getByRole("button", { name: BODY_MAP.sideBySideName }));

      expect(zoomGroup()).toBeNull();
      expect(
        screen.getAllByRole("group", { name: /^Body map, (Actual|Projected), heat, front/ }),
      ).toHaveLength(2);

      fireEvent.click(screen.getByRole("button", { name: BODY_MAP.sideBySideName }));

      expect(zoomGroup()).toBeTruthy();
    });

    it("should lay out for 2D on the next draw after a failure, for the rest of the visit", async () => {
      await openIn3D();
      act(() => {
        latestBody3D().onError?.();
      });
      cleanup();
      body3D.latest = null;

      render(<BodyMapScreen />);
      await settle();

      expect(zoomGroup()).toBeNull();
      expect(
        screen.getAllByRole("group", { name: /^Body map, Actual, heat, (front|back)/ }),
      ).toHaveLength(2);
      expect(body3D.latest).toBeNull();
    });

    it("should keep the stage layout, with the 2D figure inside, when 3D fails after it has drawn", async () => {
      await openIn3D();

      act(() => {
        latestBody3D().onError?.();
      });

      expect(zoomGroup()).toBeTruthy();
      expect(screen.getAllByRole("group", { name: /^Body map, Actual, heat, front/ })).toHaveLength(
        1,
      );
      expect(screen.queryByText(BODY_MAP.loading3d)).toBeNull();
    });
  });
});
