import path from "node:path";

export function joinSegments(segments: readonly string[]): string {
  return path.join(...segments);
}

export function describeSegments(segments: readonly string[]): string {
  return `${segments.length} segments`;
}
