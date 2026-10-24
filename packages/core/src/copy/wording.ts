// @not-in-barrel Internal to the copy: the modules use it, and it is not part of @keylow/core/copy.

/*
 * Small helpers the copy modules share. Not exported from the copy index: they are not sentences.
 */

/**
 * A name as it reads in the middle of a sentence: its first letter lowercased, as the boards write
 * "leg press set 3". A first word with a second capital in it is an acronym ("EZ bar curl") and keeps them.
 */
export const lowerFirst = (name: string): string => {
  const [firstWord = ""] = name.split(" ");
  const isAcronym = /\p{Lu}/u.test(firstWord.slice(1));
  return isAcronym ? name : name.charAt(0).toLowerCase() + name.slice(1);
};

/** A phrase at the start of a sentence: its first letter raised and the rest left as it is. */
export const capitaliseFirst = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);
