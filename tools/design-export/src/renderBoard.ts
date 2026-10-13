// Renders one board in headless Chromium. It returns the screenshot of the whole board and the
// board's DOM with the canvas runtime's traces removed, ready to become a static page.
import type { Board } from "./boards.ts";
import type { Browser } from "playwright";

export type RenderedBoard = {
  png: Buffer;
  boardHtml: string;
  lang: string;
  fontsHref: string;
  styles: string[];
};

export const deviceScaleFactor = 2;

type SerialisedBoard = Omit<RenderedBoard, "png"> & { width: number; height: number };

// Runs in the page. True once the runtime has rendered every frame of the board.
function isBoardRendered(expectedFrames: number): boolean {
  const root = document.querySelector("#dc-root > .sc-host")?.firstElementChild;
  if (root === null || root === undefined) {
    return false;
  }
  const failure = document.querySelector(".sc-logic-error, .sc-placeholder-error, .sc-unresolved");
  if (failure !== null) {
    throw new Error(`The runtime reported an error: ${failure.textContent}`);
  }
  return (
    root.querySelectorAll(".sc-host").length === expectedFrames &&
    document.querySelector(".sc-placeholder, .sc-missing") === null
  );
}

// Runs in the page. Copies the board root and strips what only the runtime needs: its sc-*
// classes and its template markers. The span the runtime wraps around each interpolated value
// stays, without its class, because in a flex or grid parent that span is a layout item of its
// own and removing it changes the spacing. The component name stays, as data-screen.
function serialiseBoard(): SerialisedBoard {
  const root = document.querySelector("#dc-root > .sc-host")?.firstElementChild;
  if (root === null || root === undefined) {
    throw new Error("The board has no root element");
  }
  const rectangle = root.getBoundingClientRect();
  const copy = root.cloneNode(true);
  if (!(copy instanceof Element)) {
    throw new Error("The board root could not be copied");
  }
  const originals = [root, ...root.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  copies.forEach((element, index) => {
    const original = originals[index];
    if (original instanceof HTMLInputElement) {
      element.setAttribute("value", original.value);
    }
    element.removeAttribute("data-dc-tpl");
    const screenName = element.getAttribute("data-sc-name");
    if (screenName !== null) {
      element.removeAttribute("data-sc-name");
      element.setAttribute("data-screen", screenName);
    }
    for (const className of [...element.classList]) {
      if (className.startsWith("sc-")) {
        element.classList.remove(className);
      }
    }
    if (element.getAttribute("class") === "") {
      element.removeAttribute("class");
    }
  });
  const fonts = document.head.querySelector('link[href^="https://fonts.googleapis.com"]');
  const styles = [...document.head.querySelectorAll("style[data-dc-tpl]")]
    .map((style) => style.textContent.trim())
    .filter((text, index, all) => all.indexOf(text) === index);
  return {
    boardHtml: copy.outerHTML,
    lang: document.documentElement.lang || "en-GB",
    fontsHref: fonts?.getAttribute("href") ?? "",
    styles,
    width: rectangle.width,
    height: rectangle.height,
  };
}

export async function renderBoard(
  browser: Browser,
  origin: string,
  board: Board,
  expectedFrames: number,
): Promise<RenderedBoard> {
  const context = await browser.newContext({
    viewport: { width: board.width, height: board.height },
    deviceScaleFactor,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    // The runtime boots on DOMContentLoaded. Waiting for the load event would also wait on Google Fonts.
    await page.goto(`${origin}/${board.fileName}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(isBoardRendered, expectedFrames, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    // Only the weights a board uses are fetched, so this asks whether any Geist face arrived.
    // A board with no text at all, such as the session cover, needs none.
    const geistLoaded = await page.evaluate(
      () =>
        document.body.innerText.trim() === "" ||
        [...document.fonts].some(
          (face) => face.family.includes("Geist") && face.status === "loaded",
        ),
    );
    if (!geistLoaded) {
      throw new Error(
        `${board.fileName}: Geist did not load from Google Fonts, so the board would render in a fallback font`,
      );
    }
    const serialised = await page.evaluate(serialiseBoard);
    if (serialised.width !== board.width || serialised.height !== board.height) {
      throw new Error(
        `${board.fileName} renders ${serialised.width}x${serialised.height}, canvas.json says ${board.width}x${board.height}`,
      );
    }
    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: board.width, height: board.height },
      animations: "disabled",
    });
    return {
      png,
      boardHtml: serialised.boardHtml,
      lang: serialised.lang,
      fontsHref: serialised.fontsHref,
      styles: serialised.styles,
    };
  } finally {
    await context.close();
  }
}
