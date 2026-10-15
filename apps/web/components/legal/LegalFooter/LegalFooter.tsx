import { LEGAL_FOOTER } from "@keylow/core/copy";
import Link from "next/link";

/** The foot of every page: who runs Ki-Lo, and the links to the Privacy Policy and the Terms of Use. */
export function LegalFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-1 border-t border-border px-4 py-4 lg:px-8">
      <p className="text-caption text-text-secondary">{LEGAL_FOOTER.companyLine}</p>
      <nav aria-label={LEGAL_FOOTER.navigationLabel}>
        <ul className="flex flex-wrap gap-x-4">
          {LEGAL_FOOTER.links.map(({ label, path }) => (
            <li key={path}>
              <Link
                href={path}
                className="inline-flex min-h-touch-target items-center rounded-small text-caption text-text-secondary underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
