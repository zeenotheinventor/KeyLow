import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RootLayout, { metadata } from "@/app/layout";

const { cookieValue } = vi.hoisted(() => ({ cookieValue: vi.fn<() => string | undefined>() }));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = name === "kl-theme" ? cookieValue() : undefined;
        return value === undefined ? undefined : { name, value };
      },
    }),
}));

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-font-variable" }),
}));

async function renderedPage() {
  const markup = renderToStaticMarkup(await RootLayout({ children: <p>Page content</p> }));
  return new DOMParser().parseFromString(markup, "text/html");
}

describe("RootLayout", () => {
  beforeEach(() => {
    cookieValue.mockReset();
  });

  it("should render dark when there is no theme cookie", async () => {
    const page = await renderedPage();

    expect(page.documentElement.dataset["theme"]).toBe("dark");
  });

  it("should render light, on the server, when the cookie says light", async () => {
    cookieValue.mockReturnValue("light");

    const page = await renderedPage();

    expect(page.documentElement.dataset["theme"]).toBe("light");
  });

  it("should render device, on the server, when the cookie says to match the device", async () => {
    cookieValue.mockReturnValue("device");

    const page = await renderedPage();

    expect(page.documentElement.dataset["theme"]).toBe("device");
  });

  it("should render dark when the cookie holds a value it does not know", async () => {
    cookieValue.mockReturnValue("sepia");

    const page = await renderedPage();

    expect(page.documentElement.dataset["theme"]).toBe("dark");
  });

  it("should declare the language and carry the Geist font variable", async () => {
    const page = await renderedPage();

    expect(page.documentElement.lang).toBe("en");
    expect(page.documentElement.classList.contains("geist-font-variable")).toBe(true);
  });

  it("should render the page inside the body", async () => {
    const page = await renderedPage();

    expect(page.body.textContent).toBe("Page content");
  });

  it("should title the app Ki-Lo", () => {
    expect(metadata.title).toBe("Ki-Lo");
  });
});
