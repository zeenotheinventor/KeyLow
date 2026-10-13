import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

// pixelmatch's own default. A pixel counts as different only when its colour distance passes it,
// so the faint difference between two anti-aliased renders of the same text is ignored.
const colourDistanceThreshold = 0.1;

export function differingPixelPercent(expected: Buffer, actual: Buffer): number {
  const expectedImage = PNG.sync.read(expected);
  const actualImage = PNG.sync.read(actual);
  if (expectedImage.width !== actualImage.width || expectedImage.height !== actualImage.height) {
    throw new Error(
      `Images differ in size: ${expectedImage.width}x${expectedImage.height} against ${actualImage.width}x${actualImage.height}`,
    );
  }
  const differing = pixelmatch(
    expectedImage.data,
    actualImage.data,
    undefined,
    expectedImage.width,
    expectedImage.height,
    { threshold: colourDistanceThreshold, includeAA: true },
  );
  return (differing / (expectedImage.width * expectedImage.height)) * 100;
}
