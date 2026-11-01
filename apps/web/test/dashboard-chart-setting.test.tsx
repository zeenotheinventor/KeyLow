import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardChartSetting } from "@/app/(dashboard)/more/DashboardChartSetting";
import {
  resetDashboardBodyScaleForTests,
  useDashboardBodyScale,
} from "@/lib/useDashboardBodyScale";

const volumeNote = "Weekly volume counts sets from Monday to Sunday.";

// Shows the chart another reader of the preference sees, as the dashboard card would.
function DashboardProbe() {
  const { scale } = useDashboardBodyScale();

  return <p>{`dashboard chart:${scale}`}</p>;
}

function renderSetting() {
  render(
    <>
      <ul>
        <DashboardChartSetting />
      </ul>
      <DashboardProbe />
    </>,
  );
}

describe("DashboardChartSetting", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    resetDashboardBodyScaleForTests();
  });

  it("should offer Heat and Weekly volume in a group named Dashboard chart, on Heat with no note by default", () => {
    renderSetting();

    expect(screen.getByRole("radiogroup", { name: "Dashboard chart" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Heat" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Weekly volume" })).toHaveProperty("checked", false);
    expect(screen.queryByText(volumeNote)).toBeNull();
  });

  it("should save Weekly volume when it is chosen, apply it to every reader, and say which days count", () => {
    renderSetting();

    fireEvent.click(screen.getByRole("radio", { name: "Weekly volume" }));

    expect(window.localStorage.getItem("bodyMap.dashboardScale")).toBe("volume");
    expect(screen.getByRole("radio", { name: "Weekly volume" })).toHaveProperty("checked", true);
    expect(screen.getByText("dashboard chart:volume")).toBeTruthy();
    expect(screen.getByText(volumeNote)).toBeTruthy();
  });

  it("should bring Heat back when Heat is chosen after Weekly volume", () => {
    renderSetting();

    fireEvent.click(screen.getByRole("radio", { name: "Weekly volume" }));
    fireEvent.click(screen.getByRole("radio", { name: "Heat" }));

    expect(window.localStorage.getItem("bodyMap.dashboardScale")).toBe("heat");
    expect(screen.getByRole("radio", { name: "Heat" })).toHaveProperty("checked", true);
    expect(screen.queryByText(volumeNote)).toBeNull();
  });

  it("should show the saved choice on a later visit", () => {
    window.localStorage.setItem("bodyMap.dashboardScale", "volume");

    renderSetting();

    expect(screen.getByRole("radio", { name: "Weekly volume" })).toHaveProperty("checked", true);
  });

  it("should show Heat when what is saved is not a chart", () => {
    window.localStorage.setItem("bodyMap.dashboardScale", "gap");

    renderSetting();

    expect(screen.getByRole("radio", { name: "Heat" })).toHaveProperty("checked", true);
  });
});
