import { ABOUT_SCREEN } from "@keylow/core/copy";
import { useId } from "react";

import { PageFrame } from "../PageFrame";
import { DataSourceCredit } from "./DataSourceCredit";

export default function AboutPage() {
  const { dataSources } = ABOUT_SCREEN;
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
      </div>
    </PageFrame>
  );
}
