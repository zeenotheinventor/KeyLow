"use client";

import { iconStroke } from "@keylow/tokens";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { DashboardSection } from "./types";

import { Button } from "@/components/ui/Button";
import { KiLoMark } from "@/components/ui/KiLoMark";
import { SearchLauncher } from "@/components/ui/SearchField";
import { cn } from "@/lib/utils";

const SECTIONS: readonly DashboardSection[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Diary", href: "/diary" },
  { label: "Recipes", href: "/recipes" },
  { label: "More", href: "/more" },
];

const FOODS_HREF = "/foods";
const FOOD_PAGE_PREFIX = "/foods/";
const FOODS_BARCODE_HREF = "/foods?panel=barcode";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/**
 * The top bar of the signed-in app: the mark, the four sections and the food search. From the
 * large breakpoint the sections sit in the bar. Below it they move into the menu, as the boards draw.
 */
export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
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

  function goToFoods() {
    router.push(FOODS_HREF);
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
            aria-label="Main"
            className={cn(
              "absolute inset-x-4 top-[76px] z-10 rounded-large border border-border bg-surface-sheet p-2 shadow-card lg:static lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
              isMenuOpen ? "block" : "hidden",
            )}
          >
            <ul className="flex flex-col lg:flex-row lg:gap-1">
              {SECTIONS.map(({ label, href }) => {
                const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

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
            label="Search for a food"
            onSearch={goToFoods}
            barcodeButton={{
              label: "Look up a barcode",
              onClick: () => {
                router.push(FOODS_BARCODE_HREF);
              },
            }}
            className={cn("lg:ml-auto lg:w-[320px]", isFoodPage && "max-lg:hidden")}
          />
        )}
      </div>
    </header>
  );
}
