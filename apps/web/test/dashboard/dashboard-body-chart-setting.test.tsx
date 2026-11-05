import { MORE_SCREEN } from "@keylow/core/copy";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DashboardBodyChartSetting } from "@/app/(dashboard)/more/DashboardBodyChartSetting";
import { useDashboardBodyChart } from "@/lib/dashboardBodyChart";
import { resetDashboardBodyChartForTests } from "@/lib/dashboardBodyChart/testing";

const { dashboardBodyChart } = MORE_SCREEN.settings;

function Reader() {
  const { chart } = useDashboardBodyChart();
  return <p role="status">{chart}</p>;
}

function renderSetting() {
  render(
    <>
      <ul>
        <DashboardBodyChartSetting />
      </ul>
      <Reader />
    </>,
  );
}

describe("DashboardBodyChartSetting", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDashboardBodyChartForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("should offer Heat and Weekly volume in a group named Dashboard body map", () => {
    renderSetting();

    expect(screen.getByRole("radiogroup", { name: dashboardBodyChart.title })).toBeTruthy();
    expect(screen.getByRole("radio", { name: dashboardBodyChart.options.heat })).toBeTruthy();
    expect(screen.getByRole("radio", { name: dashboardBodyChart.options.volume })).toBeTruthy();
  });

  it("should show Heat chosen, with its caption, when nothing is saved", () => {
    renderSetting();

    expect(screen.getByRole("radio", { name: dashboardBodyChart.options.heat })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByText(dashboardBodyChart.captions.heat)).toBeTruthy();
    expect(screen.queryByText(dashboardBodyChart.captions.volume)).toBeNull();
  });

  it("should show Weekly volume chosen, with its caption, when it is saved", () => {
    window.localStorage.setItem("dashboard.bodyChart", "volume");
    renderSetting();

    expect(screen.getByRole("radio", { name: dashboardBodyChart.options.volume })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByText(dashboardBodyChart.captions.volume)).toBeTruthy();
  });

  it("should choose Weekly volume when it is pressed, save it, and tell every other reader", () => {
    renderSetting();

    fireEvent.click(screen.getByRole("radio", { name: dashboardBodyChart.options.volume }));

    expect(screen.getByRole("radio", { name: dashboardBodyChart.options.volume })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByText(dashboardBodyChart.captions.volume)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("volume");
    expect(window.localStorage.getItem("dashboard.bodyChart")).toBe("volume");
  });
});
