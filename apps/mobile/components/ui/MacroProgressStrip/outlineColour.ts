// Zee's ruling (17): over target, the ring is "the colour mixed with white", which the board writes as
// 55 per cent colour and 45 per cent white.
const whiteShare = 0.45;
const WHITE_CHANNEL = 255;

const hexColourPattern = /^#[0-9a-fA-F]{6}$/;

const channelAt = (hexColour: string, start: number): number =>
  parseInt(hexColour.slice(start, start + 2), 16);

const mixedWithWhite = (channel: number): number =>
  Math.round(channel * (1 - whiteShare) + WHITE_CHANNEL * whiteShare);

/** A `#RRGGBB` token colour mixed with white as the over-target outline is: `rgb(158, 230, 223)`. */
export function outlineColour(hexColour: string): string {
  if (!hexColourPattern.test(hexColour)) {
    throw new RangeError(`Expected a #RRGGBB colour, got "${hexColour}"`);
  }
  const [red, green, blue] = [1, 3, 5].map((start) => mixedWithWhite(channelAt(hexColour, start)));

  return `rgb(${red}, ${green}, ${blue})`;
}
