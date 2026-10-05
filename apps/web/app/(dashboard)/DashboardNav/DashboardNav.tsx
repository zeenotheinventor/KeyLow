"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const TABS = [
  { label: "Diary", href: "/diary" },
  { label: "Recipes", href: "/recipes" },
  { label: "Weight", href: "/weight" },
  { label: "Settings", href: "/settings" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard">
      <ul className="flex flex-wrap gap-1">
        {TABS.map(({ label, href }) => {
          const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Button asChild variant={isCurrent ? "secondary" : "ghost"} className="h-11 md:h-9">
                <Link href={href} aria-current={isCurrent ? "page" : undefined}>
                  {label}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
