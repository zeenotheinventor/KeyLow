import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Clock } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantNotice } from "@/components/ui/AssistantNotice";

afterEach(cleanup);

describe("AssistantNotice", () => {
  it("should say its title and paragraphs as a status", () => {
    render(
      <AssistantNotice
        icon={Clock}
        paragraphs={["Back at midnight.", "Logging still works."]}
        title="You have used today's turns"
      />,
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("You have used today's turns");
    expect(status.textContent).toContain("Back at midnight.");
    expect(status.textContent).toContain("Logging still works.");
  });

  it("should say a danger notice as an alert", () => {
    render(
      <AssistantNotice icon={Clock} paragraphs={["Try again."]} title="Failed" tone="danger" />,
    );

    expect(screen.getByRole("alert").textContent).toContain("Failed");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should draw a danger notice with a danger border", () => {
    render(<AssistantNotice icon={Clock} paragraphs={[]} title="Failed" tone="danger" />);

    expect(screen.getByRole("alert").parentElement?.className).toContain("border-danger");
  });

  it("should draw no button when it has none", () => {
    render(<AssistantNotice icon={Clock} paragraphs={["Body"]} title="Title" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("should call a button's handler when it is pressed", async () => {
    const onClick = vi.fn();
    render(
      <AssistantNotice
        buttons={[{ label: "Try again", onClick }]}
        icon={Clock}
        paragraphs={["Body"]}
        title="Title"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should keep the button out of the announced group", () => {
    render(
      <AssistantNotice
        buttons={[{ label: "Try again", onClick: vi.fn() }]}
        icon={Clock}
        paragraphs={["Body"]}
        title="Title"
        tone="danger"
      />,
    );

    expect(screen.getByRole("alert").textContent).not.toContain("Try again");
  });

  it("should not respond to a disabled button", async () => {
    const onClick = vi.fn();
    render(
      <AssistantNotice
        buttons={[{ label: "Try again", onClick, isDisabled: true }]}
        icon={Clock}
        paragraphs={["Body"]}
        title="Title"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
