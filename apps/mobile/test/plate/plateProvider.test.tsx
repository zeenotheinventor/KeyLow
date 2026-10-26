import { onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { withPlate } from "./support/plateHarness";
import { chickenAndRice, oatBarInBars, oatBarInGrams } from "./support/plateItems";
import { usePlate, usePlateExit, usePlateLoggingGuard } from "../../lib/plate";
import { profileTimeZone, resetApiClientMock } from "../foods/support/apiClientMock";

// Nothing is stored in these tests, but the theme reads the phone's small store.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockApiClient: unknown }>("../foods/support/apiClientMock").mockApiClient,
);

const keysOf = (items: readonly { key: string }[]) => items.map(({ key }) => key);

describe("the plate store", () => {
  beforeEach(() => {
    resetApiClientMock();
    onlineManager.setOnline(true);
  });

  async function renderPlate(props: { initialTime?: string } = {}) {
    return renderHook(() => ({ ...usePlate(), ...usePlateLoggingGuard(), ...usePlateExit() }), {
      wrapper: withPlate(props),
    });
  }

  it("should start empty", async () => {
    const { result } = await renderPlate();

    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.totals.kcal).toBe(0);
    expect(result.current.addCount).toBe(0);
    expect(result.current.canLog).toBe(false);
  });

  it("should throw a clear error outside a plate", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(renderHook(() => usePlate())).rejects.toThrow(
      "usePlate must be used inside a PlateProvider",
    );

    consoleError.mockRestore();
  });

  describe("adding", () => {
    it("should put each new food at the end of the plate, with a key of its own", async () => {
      const { result } = await renderPlate();

      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
        result.current.add((key) => chickenAndRice(key));
      });

      expect(result.current.items.map(({ kind }) => kind)).toEqual(["food", "recipe"]);
      expect(new Set(keysOf(result.current.items)).size).toBe(2);
      expect(result.current.count).toBe(2);
    });

    it("should merge the same food in the same unit into the row that is there", async () => {
      const { result } = await renderPlate();

      await act(() => {
        result.current.add((key) => oatBarInGrams(key, 100));
      });
      const [firstRow] = result.current.items;
      await act(() => {
        result.current.add((key) => oatBarInGrams(key, 50));
      });

      expect(result.current.count).toBe(1);
      expect(result.current.items[0]).toMatchObject({ key: firstRow?.key, quantity: 150 });
    });

    it("should not merge the same food in another unit", async () => {
      const { result } = await renderPlate();

      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
        result.current.add((key) => oatBarInBars(key));
      });

      expect(result.current.count).toBe(2);
    });

    it("should count every add, a merge included, so the search can clear its field", async () => {
      const { result } = await renderPlate();

      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
      });
      expect(result.current.addCount).toBe(1);
      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
      });

      expect(result.current.addCount).toBe(2);
    });

    it("should not count removing, editing or clearing as an add", async () => {
      const { result } = await renderPlate();
      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
      });
      const [row] = result.current.items;

      await act(() => {
        result.current.setQuantity(row?.key ?? "", "200");
        result.current.remove(row?.key ?? "");
        result.current.clear();
      });

      expect(result.current.addCount).toBe(1);
    });
  });

  describe("totals", () => {
    it("should add up what the rows come to", async () => {
      const { result } = await renderPlate();

      await act(() => {
        result.current.add((key) => oatBarInGrams(key, 100));
        result.current.add((key) => oatBarInBars(key));
      });

      // 100 g of the oat bar is 420 kcal, and one bar of 45 g is 189 kcal.
      expect(result.current.totals.kcal).toBeCloseTo(609);
      expect(result.current.totals.count).toBe(2);
    });
  });

  describe("editing", () => {
    it("should set a row's amount from what is typed, and leave the others alone", async () => {
      const { result } = await renderPlate();
      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
        result.current.add((key) => chickenAndRice(key));
      });
      const [oatBar, chicken] = result.current.items;

      await act(() => {
        result.current.setQuantity(oatBar?.key ?? "", "250");
      });

      expect(result.current.items[0]).toMatchObject({ quantityText: "250", quantity: 250 });
      expect(result.current.items[1]).toEqual(chicken);
    });

    it("should swap a row in place and keep its key", async () => {
      const { result } = await renderPlate();
      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
        result.current.add((key) => chickenAndRice(key));
      });
      const [oatBar] = result.current.items;

      await act(() => {
        result.current.replace(oatBar?.key ?? "", (key) => oatBarInBars(key, 2));
      });

      expect(result.current.items[0]).toMatchObject({
        key: oatBar?.key,
        quantity: 2,
        unit: { kind: "portion" },
      });
      expect(result.current.count).toBe(2);
    });

    it("should remove a row", async () => {
      const { result } = await renderPlate();
      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
        result.current.add((key) => chickenAndRice(key));
      });
      const [oatBar] = result.current.items;

      await act(() => {
        result.current.remove(oatBar?.key ?? "");
      });

      expect(result.current.items.map(({ kind }) => kind)).toEqual(["recipe"]);
    });

    it("should empty the plate on clear and put it back on restore", async () => {
      const { result } = await renderPlate();
      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
        result.current.add((key) => chickenAndRice(key));
      });
      const before = result.current.items;

      await act(() => {
        result.current.clear();
      });
      expect(result.current.items).toEqual([]);

      await act(() => {
        result.current.restore();
      });
      expect(result.current.items).toEqual(before);
    });
  });

  describe("the time", () => {
    it("should be now to start with", async () => {
      const { result } = await renderPlate();

      expect(result.current.time).toEqual({ isNow: true });
    });

    it("should start at the hour an hour's plus opened the sheet on", async () => {
      const { result } = await renderPlate({ initialTime: "12:00" });

      expect(result.current.time).toEqual({ isNow: false, time: "12:00" });
    });

    it("should change to a chosen time and back to now", async () => {
      const { result } = await renderPlate();

      await act(() => {
        result.current.setTime({ isNow: false, time: "19:20" });
      });
      expect(result.current.time).toEqual({ isNow: false, time: "19:20" });

      await act(() => {
        result.current.setTime({ isNow: true });
      });
      expect(result.current.time).toEqual({ isNow: true });
    });
  });

  describe("when it can be logged", () => {
    async function renderWithOneFood() {
      const rendered = await renderPlate();
      await act(() => {
        rendered.result.current.add((key) => oatBarInGrams(key));
      });

      return rendered;
    }

    it("should be possible with a food, a connection and the profile's zone", async () => {
      const { result } = await renderWithOneFood();

      expect(result.current.canLog).toBe(true);
    });

    it("should not be possible offline, and should be again when the connection returns", async () => {
      const { result } = await renderWithOneFood();

      await act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current.canLog).toBe(false);

      await act(() => {
        onlineManager.setOnline(true);
      });
      expect(result.current.canLog).toBe(true);
    });

    it("should not be possible until the profile's zone is known", async () => {
      profileTimeZone.current = { data: undefined, isPending: true, isError: false };
      const { result } = await renderWithOneFood();

      expect(result.current.canLog).toBe(false);
    });

    it("should not be possible while a row's amount is not valid", async () => {
      const { result } = await renderWithOneFood();

      await act(() => {
        result.current.setQuantity(result.current.items[0]?.key ?? "", "");
      });

      expect(result.current.canLog).toBe(false);
    });

    it("should not be possible while the plate is being logged", async () => {
      const { result } = await renderWithOneFood();

      await act(() => {
        result.current.startLogging();
      });

      expect(result.current.isLogging).toBe(true);
      expect(result.current.canLog).toBe(false);
    });
  });

  describe("logging in flight", () => {
    it("should let one caller start and turn a second away in the same tick", async () => {
      const { result } = await renderPlate();

      let started: boolean[] = [];
      await act(() => {
        started = [result.current.startLogging(), result.current.startLogging()];
      });

      expect(started).toEqual([true, false]);
    });

    it("should let the next caller start once logging has finished", async () => {
      const { result } = await renderPlate();
      await act(() => {
        result.current.startLogging();
        result.current.finishLogging();
      });
      expect(result.current.isLogging).toBe(false);

      let started = false;
      await act(() => {
        started = result.current.startLogging();
      });

      expect(started).toBe(true);
    });
  });

  describe("a plate that has been logged", () => {
    it("should not be logged to start with, nor while it is being logged", async () => {
      const { result } = await renderPlate();
      expect(result.current.isLogged).toBe(false);

      await act(() => {
        result.current.startLogging();
      });

      expect(result.current.isLogged).toBe(false);
    });

    it("should be logged once marked, and run what it was given only after the render that shows it", async () => {
      const { result } = await renderPlate();
      const seenByTheCallback: boolean[] = [];

      await act(() => {
        result.current.markLogged(() => {
          seenByTheCallback.push(result.current.isLogged);
        });
      });

      expect(seenByTheCallback).toEqual([true]);
      expect(result.current.isLogged).toBe(true);
    });

    it("should run what it was given once", async () => {
      const { result } = await renderPlate();
      const afterwards = jest.fn();

      await act(() => {
        result.current.markLogged(afterwards);
      });
      await act(() => {
        result.current.add((key) => oatBarInGrams(key));
      });

      expect(afterwards).toHaveBeenCalledTimes(1);
    });
  });

  describe("asking to discard the plate", () => {
    it("should not be asking to start with", async () => {
      const { result } = await renderPlate();

      expect(result.current.isAsking).toBe(false);
      expect(result.current.isDiscarded).toBe(false);
    });

    it("should be asking once asked, and not any more on Keep adding", async () => {
      const { result } = await renderPlate();

      await act(() => {
        result.current.ask();
      });
      expect(result.current.isAsking).toBe(true);
      await act(() => {
        result.current.keep();
      });

      expect(result.current.isAsking).toBe(false);
      expect(result.current.isDiscarded).toBe(false);
    });

    it("should be discarded, and no longer asking, on Discard", async () => {
      const { result } = await renderPlate();
      await act(() => {
        result.current.ask();
      });

      await act(() => {
        result.current.discard();
      });

      expect(result.current.isAsking).toBe(false);
      expect(result.current.isDiscarded).toBe(true);
    });
  });

  it("should be gone when the sheet closes, with nothing kept for the next one", async () => {
    const first = await renderPlate();
    await act(() => {
      first.result.current.add((key) => oatBarInGrams(key));
    });
    expect(first.result.current.count).toBe(1);

    await first.unmount();
    const second = await renderPlate();

    expect(second.result.current.items).toEqual([]);
    expect(second.result.current.addCount).toBe(0);
  });
});
