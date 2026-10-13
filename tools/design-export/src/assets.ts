// The files the boards load through the canvas host, by the /_blob/ URL the canvas gave each one.
// Each is committed under docs/design, and a static page links it by relative path instead.

export type CanvasAsset = {
  blob: string;
  file: string;
  contentType: string;
};

export const canvasAssets: readonly CanvasAsset[] = [
  {
    blob: "/_blob/a1c55461938510f7678509d58bd52ada",
    file: "tokens/kilo-tokens.css",
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

// The page for a board lives one folder below docs/design, so the files are one level up.
export function relativeAssetUrls(): Record<string, string> {
  return Object.fromEntries(canvasAssets.map((asset) => [asset.blob, `../${asset.file}`]));
}
