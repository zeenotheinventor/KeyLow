import Link from "next/link";

import { ComingSoon } from "../ComingSoon";

import { Button } from "@/components/ui/button";

export default function DiaryPage() {
  return (
    <div className="flex flex-col gap-4">
      <ComingSoon title="Diary" />
      <Button asChild className="h-11 self-start md:h-9">
        <Link href="/foods">Find food</Link>
      </Button>
    </div>
  );
}
