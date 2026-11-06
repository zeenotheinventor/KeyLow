// The sections a new account is sent from, by their exact addresses. This is a list of its own, apart from the
// nav's `alsoCurrentOn`, which is about what to highlight. A page under a section (`/more/targets`, `/diary/...`,
// `/foods/...`) is not covered, so a deep link is never taken over. `usePathname` leaves the query off, so
// `/diary?date=...` reads as `/diary`, and Next never gives a trailing slash.
const FIRST_RUN_SECTIONS = new Set<string>(["/dashboard", "/diary", "/train", "/more"]);

export const isFirstRunSection = (pathname: string): boolean => FIRST_RUN_SECTIONS.has(pathname);

/** The wizard itself, at any of its steps. A person who is here is never sent. */
export const isSetupWizardPath = (pathname: string): boolean =>
  pathname === "/setup" || pathname.startsWith("/setup/");
