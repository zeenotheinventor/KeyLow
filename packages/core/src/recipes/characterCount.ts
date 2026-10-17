/** Characters as the database counts them: code points, so an emoji is one and not two. */
export const characterCount = (text: string): number => Array.from(text).length;
