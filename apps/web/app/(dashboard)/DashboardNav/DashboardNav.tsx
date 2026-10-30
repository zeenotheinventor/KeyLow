"use client";

import { SEARCH_LAUNCHER, TAB_BAR_LABEL, TAB_TITLES } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { DashboardSection } from "./types";

import { Button } from "@/components/ui/Button";
import { KiLoMark } from "@/components/ui/KiLoMark";
import { SearchLauncher } from "@/components/ui/SearchField";
import { useFoodLogActions } from "@/lib/foodLogActions";
import { recipesPath } from "@/lib/recipeRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { cn } from "@/lib/utils";

// Recipes is not a section. Its library is a row of More's Nutrition section, so More stays current on it.
const SECTIONS: readonly DashboardSection[] = [
  { label: TAB_TITLES.dashboard, href: "/dashboard" },
  { label: TAB_TITLES.diary, href: "/diary" },
  { label: TAB_TITLES.more, href: "/more", alsoCurrentOn: [recipesPath()] },
];

// A section is current on its own page, on the pages under it, and on the pages it holds that live elsewhere.
const isUnder = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

const isCurrentSection = (pathname: string, section: DashboardSection): boolean =>
  [section.href, ...(section.alsoCurrentOn ?? [])].some((href) => isUnder(pathname, href));

const FOODS_HREF = "/foods";
const FOOD_PAGE_PREFIX = "/foods/";
const FOODS_BARCODE_HREF = "/foods?panel=barcode";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/**
 * The top bar of the signed-in app: the mark, the three sections and the food search. From the
 * large breakpoint the sections sit in the bar. Below it they move into the menu, as the boards draw.
 */
export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { viewedDate, openAddFood } = useFoodLogActions();
  const isOnline = useIsOnline();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  // Going to another page closes the menu, and coming back to this one does not reopen it.
  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setIsMenuOpen(false);
  }
  // The boards leave the launcher out of the foods page, which has a search field of its own, and
  // out of the food detail and form pages below the large breakpoint.
  const isFoodsPage = pathname === FOODS_HREF;
  const isFoodPage = pathname.startsWith(FOOD_PAGE_PREFIX);
  const menuButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();

  // The search always adds food: to the day on view on the diary, and to today, at now, on every other page.
  // Browsing foods without logging is the Foods page, reached from More.
  function startSearch() {
    openAddFood(viewedDate === undefined ? {} : { date: viewedDate });
  }

  // The foods page is not the diary, so the day on view goes with the person, as it does for the search.
  function startBarcodeLookup() {
    router.push(
      viewedDate === undefined ? FOODS_BARCODE_HREF : `${FOODS_BARCODE_HREF}&day=${viewedDate}`,
    );
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButton.current?.focus();
      }
    }

    // The menu button toggles the menu itself, so a press on it is left alone.
    function closeOnPressOutside(event: PointerEvent) {
      const target = event.target;
      const isInside =
        target instanceof Node &&
        (panel.current?.contains(target) === true || menuButton.current?.contains(target) === true);
      if (!isInside) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPressOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPressOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="relative border-b border-border bg-surface px-4 py-4 lg:px-8 lg:py-[14px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            aria-label="Ki-Lo"
            className={cn("flex items-center gap-2 rounded-small text-text-primary", focusRing)}
          >
            <KiLoMark />
            <span className="text-h2">Ki-Lo</span>
          </Link>
          <Button
            ref={menuButton}
            variant="secondary"
            iconOnly
            aria-label="Menu"
            aria-expanded={isMenuOpen}
            aria-controls={panelId}
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
            }}
            className="ml-auto lg:hidden"
          >
            <Menu aria-hidden strokeWidth={iconStroke} />
          </Button>
          <nav
            ref={panel}
            id={panelId}
            aria-label={TAB_BAR_LABEL}
            className={cn(
              "absolute inset-x-4 top-[76px] z-10 rounded-large border border-border bg-surface-sheet p-2 shadow-card lg:static lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
              isMenuOpen ? "block" : "hidden",
            )}
          >
            <ul className="flex flex-col lg:flex-row lg:gap-1">
              {SECTIONS.map((section) => {
                const { label, href } = section;
                const isCurrent = isCurrentSection(pathname, section);

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={() => {
                        setIsMenuOpen(false);
                      }}
                      className={cn(
                        "flex min-h-touch-target items-center rounded-medium px-3 text-body-strong transition-colors duration-quick hover:bg-hover-overlay lg:h-9 lg:min-h-0 lg:rounded-small lg:text-[14px] lg:leading-5",
                        focusRing,
                        isCurrent ? "bg-surface-raised text-text-primary" : "text-text-secondary",
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        {!isFoodsPage && (
          <SearchLauncher
            size="adaptive"
            label={SEARCH_LAUNCHER.label}
            onSearch={startSearch}
            // A search cannot run offline, so the launcher is dimmed on every page of the shell.
            disabled={!isOnline}
            barcodeButton={{
              label: SEARCH_LAUNCHER.lookUpLabel,
              onClick: startBarcodeLookup,
            }}
            className={cn("lg:ml-auto lg:w-[320px]", isFoodPage && "max-lg:hidden")}
          />
        )}
      </div>
    </header>
  );
}
