import { screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { renderAuthScreen } from "./support/renderAuthScreen";
import { AuthMessage } from "../components/AuthMessage";

import type { AuthMessageTone } from "../components/AuthMessage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("AuthMessage", () => {
  it.each<[AuthMessageTone, "alert" | "status"]>([
    ["danger", "alert"],
    ["neutral", "status"],
    ["success", "status"],
  ])("should announce its words as %s: a %s", async (tone, role) => {
    await renderAuthScreen(
      <AuthMessage body="The body." icon="Mail" title="The title" tone={tone} />,
    );

    expect(screen.getByRole(role, { name: "The title The body." })).toBeOnTheScreen();
  });

  it("should draw the title as a heading", async () => {
    await renderAuthScreen(
      <AuthMessage body="The body." icon="Mail" title="The title" tone="neutral" />,
    );

    expect(screen.getByRole("heading", { name: "The title" })).toBeOnTheScreen();
  });

  it("should leave its buttons reachable, outside the announced words", async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const user = userEvent.setup();
    await renderAuthScreen(
      <AuthMessage
        body="The body."
        icon="TriangleAlert"
        primary={{ label: "Do it", onPress: onPrimary }}
        secondary={{ label: "Go back", onPress: onSecondary }}
        title="The title"
        tone="danger"
      />,
    );

    await user.press(screen.getByRole("button", { name: "Do it" }));
    await user.press(screen.getByRole("button", { name: "Go back" }));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("should draw no buttons when it is given none", async () => {
    await renderAuthScreen(
      <AuthMessage body="The body." icon="CircleCheck" title="The title" tone="success" />,
    );

    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("should draw its footer under the buttons", async () => {
    await renderAuthScreen(
      <AuthMessage
        body="The body."
        icon="Mail"
        secondary={{ label: "Go back", onPress: jest.fn() }}
        title="The title"
        tone="neutral"
      >
        <Text>The footer</Text>
      </AuthMessage>,
    );

    expect(screen.getByText("The footer")).toBeOnTheScreen();
  });
});
