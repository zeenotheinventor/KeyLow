// Reads facts out of a board's source file without running it.

export function readPageTitle(source: string): string {
  const title = /<title>([^<]*)<\/title>/.exec(source)?.[1];
  if (title === undefined) {
    throw new Error("The board has no <title>");
  }
  return title;
}

// Each <dc-import> is one frame (one theme, and one width on the web). The runtime has
// finished booting when the page holds that many rendered frames.
export function countFrames(source: string): number {
  return source.match(/<dc-import\b/g)?.length ?? 0;
}
