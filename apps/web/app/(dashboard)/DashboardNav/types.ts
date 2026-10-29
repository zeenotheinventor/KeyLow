export type DashboardSection = {
  label: string;
  href: string;
  /** Pages outside `href` that the section holds, so it is still current on them and the pages under them. */
  alsoCurrentOn?: readonly string[];
};
