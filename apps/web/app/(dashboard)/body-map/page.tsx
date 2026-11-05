import { bodyMapScaleOf } from "@keylow/core/training";

import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { BodyMapScreen } from "@/components/body";
import { BODY_MAP_SCALE_PARAMETER } from "@/lib/bodyMapRoutes";

type BodyMapPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The dashboard's body map card and the Train page's both open this page. The top bar marks Train as current
// here, as the body map boards draw it. The address can name the scale it opens on (`?scale=volume`), and
// anything else opens Heat.
export default async function BodyMapPage({ searchParams }: BodyMapPageProps) {
  const scale = (await searchParams)[BODY_MAP_SCALE_PARAMETER];

  return (
    <PageFrame variant="diary">
      <BodyMapScreen initialScale={bodyMapScaleOf(scale)} />
    </PageFrame>
  );
}
