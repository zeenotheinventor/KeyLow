// The canvas token file ends with a block of canvas-only proposals that the design system does not
// have yet. The pages link that block as its own stylesheet, after the packages/tokens one.

const proposalsMarker = "/* ---- Proposed additions";

export function extractProposals(canvasTokensCss: string): string {
  const start = canvasTokensCss.indexOf(proposalsMarker);
  if (start === -1) {
    throw new Error(`The canvas token file has no block marked "${proposalsMarker}"`);
  }
  return canvasTokensCss.slice(start);
}
