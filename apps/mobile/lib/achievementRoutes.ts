/** The Achievements screen, inside the More tab, so the tab bar stays with More current. */
export const achievementsPath = (): string => "/more/achievements";

/** One badge's detail, a bottom sheet over the Achievements screen. The id is the catalogue's, such as `hat-trick`. */
export const achievementPath = (id: string): string => `${achievementsPath()}/${id}`;
