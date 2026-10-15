// The files the boards load through the canvas host, by the /_blob/ URL the canvas gave each one.
// A blob map (a JSON file of blob URL to file path inside the canvas folder) says which is which,
// because the URLs change with each canvas. Each file is committed under the canvas's source folder
// in docs/design, so the export can render the canvas from committed files.
// A static page links the brand marks by relative path. It links the packages/tokens stylesheet
// instead of the canvas copy of the tokens.

export type CanvasAsset = {
  blob: string;
  // Path inside the canvas folder, such as tokens/kilo-tokens.css. The same path is used under the
  // source folder in docs/design.
  file: string;
  contentType: string;
};

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

const tokenStylesheetFile = "tokens/kilo-tokens.css";

function contentTypeOf(file: string): string | undefined {
  return contentTypes[file.slice(file.lastIndexOf("."))];
}

export function parseBlobMap(json: unknown): CanvasAsset[] {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("The blob map must be an object of blob URL to file path");
  }
  return Object.entries(json).map(([blob, file]) => {
    if (!blob.startsWith("/_blob/")) {
      throw new Error(`Blob map: ${blob} is not a /_blob/ URL`);
    }
    if (typeof file !== "string") {
      throw new Error(`Blob map: ${blob} needs a file path`);
    }
    if (file.includes("..") || file.startsWith("/")) {
      throw new Error(`Blob map: ${file} is outside the canvas folder`);
    }
    const contentType = contentTypeOf(file);
    if (contentType === undefined) {
      throw new Error(`Blob map: no content type for ${file}`);
    }
    return { blob, file, contentType };
  });
}

// A page for a board lives one folder below docs/design, so the packages/tokens CSS is three levels
// up and the files kept under docs/design are one level up.
export const tokensStylesheetHref = "../../../packages/tokens/css/kilo-tokens.css";
export const proposalsStylesheetHref = "../tokens/kilo-proposals.css";

export function canvasStylesheetHref(fileName: string): string {
  return `../tokens/${fileName}`;
}

export function relativeAssetUrls(
  assets: readonly CanvasAsset[],
  sourceFolder: string,
): Record<string, string> {
  return Object.fromEntries(
    assets
      .filter((asset) => asset.contentType !== "text/css")
      .map((asset) => [asset.blob, `../${sourceFolder}/${asset.file}`]),
  );
}

// The stylesheets a canvas loads besides the token stylesheet, such as the M3 canvas helpers. They
// are shipped beside the proposals stylesheet and linked from every page of that canvas.
export function canvasStylesheetFiles(assets: readonly CanvasAsset[]): string[] {
  return assets
    .filter((asset) => asset.contentType === "text/css" && asset.file !== tokenStylesheetFile)
    .map((asset) => asset.file.slice(asset.file.lastIndexOf("/") + 1));
}
