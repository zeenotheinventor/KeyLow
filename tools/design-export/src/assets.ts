// The files the boards load through the canvas host, by the /_blob/ URL the canvas gave each one.
// Each is committed under docs/design, so the export can render the canvas from committed files.
// A static page links the brand marks by relative path. It links the packages/tokens stylesheet
// instead of the canvas copy of the tokens.

export type CanvasAsset = {
  blob: string;
  file: string;
  contentType: string;
};

export const canvasAssets: readonly CanvasAsset[] = [
  {
    blob: "/_blob/a1c55461938510f7678509d58bd52ada",
    file: "source/tokens/kilo-tokens.css",
    contentType: "text/css",
  },
  {
    blob: "/_blob/2813d66c30ea89aefd67a23cc03508e1",
    file: "source/brand/mark.svg",
    contentType: "image/svg+xml",
  },
  {
    blob: "/_blob/d2f75bf70c7629f797c5d7f941462d40",
    file: "source/brand/mark-on-light.svg",
    contentType: "image/svg+xml",
  },
];

// A page for a board lives one folder below docs/design, so the packages/tokens CSS is three levels
// up and the files kept under docs/design are one level up.
export const tokensStylesheetHref = "../../../packages/tokens/css/kilo-tokens.css";
export const proposalsStylesheetHref = "../tokens/kilo-proposals.css";

export function relativeAssetUrls(): Record<string, string> {
  return Object.fromEntries(
    canvasAssets
      .filter((asset) => asset.contentType !== "text/css")
      .map((asset) => [asset.blob, `../${asset.file}`]),
  );
}
