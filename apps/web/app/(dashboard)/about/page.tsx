import { ABOUT_SCREEN, LEGAL_PATHS } from "@keylow/core/copy";
import { APP_VERSION, formatAppVersion } from "@keylow/core/format";
import { FileText, Shield } from "lucide-react";
import { useId } from "react";

import { PageFrame } from "../PageFrame";
import { DataSourceCredit } from "./DataSourceCredit";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";

export default function AboutPage() {
  const { dataSources, legal } = ABOUT_SCREEN;
  const dataSourcesHeadingId = useId();

  return (
    <PageFrame variant="shell">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-h1">{ABOUT_SCREEN.title}</h1>
        <section aria-labelledby={dataSourcesHeadingId} className="flex flex-col gap-2">
          <h2 id={dataSourcesHeadingId} className="px-1 text-body-strong">
            {dataSources.title}
          </h2>
          <DataSourceCredit
            name={dataSources.cofid.name}
            text={dataSources.cofid.text}
            url={dataSources.cofid.url}
          />
          <DataSourceCredit
            name={dataSources.off.name}
            text={dataSources.off.text}
            url={dataSources.off.url}
          />
        </section>
        <GroupedList title={legal.title} headerSize="compact">
          <ListRow icon={Shield} title={legal.privacy} href={LEGAL_PATHS.privacy} />
          <ListRow icon={FileText} title={legal.terms} href={LEGAL_PATHS.terms} />
        </GroupedList>
        {/* Vercel sets the commit while it builds, and this page is prerendered, so each deployment keeps its own. It is unset locally. */}
        <p className="px-1 text-caption text-text-secondary">
          {formatAppVersion({ version: APP_VERSION, commit: process.env.VERCEL_GIT_COMMIT_SHA })}
        </p>
      </div>
    </PageFrame>
  );
}
