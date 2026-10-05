import { render, screen } from "@testing-library/react-native";

import IndexRoute from "../app/index";

describe("index route", () => {
  it("should render the KeyLow heading", async () => {
    await render(<IndexRoute />);

    expect(screen.getByRole("header", { name: "KeyLow" })).toBeOnTheScreen();
  });

  it("should render the brand colour read from the shared tokens", async () => {
    await render(<IndexRoute />);

    expect(screen.getByText("#3b82f6")).toBeOnTheScreen();
  });
});
