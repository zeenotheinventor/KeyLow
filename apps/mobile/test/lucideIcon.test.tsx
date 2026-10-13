import { render, screen } from "@testing-library/react-native";
import { Search } from "lucide-react-native";

describe("Lucide icon", () => {
  it("should render, with an accessible name when it is given one", async () => {
    await render(<Search accessible aria-label="Search" role="img" size={24} strokeWidth={1.75} />);

    expect(screen.getByRole("img", { name: "Search" })).toBeOnTheScreen();
  });

  it("should stay hidden from screen readers when it is decoration", async () => {
    await render(<Search size={24} strokeWidth={1.75} />);

    expect(screen.queryByRole("img")).not.toBeOnTheScreen();
  });
});
