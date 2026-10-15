import type { LegalPageProps } from "./types";

/** A public page that shows one legal document, in a column that is a comfortable width to read. */
export function LegalPage({ legalDocument }: LegalPageProps) {
  return (
    <main className="px-4 py-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-large border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">{legalDocument.title}</h1>
          <p className="text-caption text-text-secondary">{legalDocument.lastUpdated}</p>
        </div>
        {legalDocument.sections.map((section, sectionIndex) => (
          <div key={`${section.heading}-${sectionIndex}`} className="flex flex-col gap-2">
            <h2 className="text-body-strong">{section.heading}</h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={`${section.heading}-paragraph-${paragraphIndex}`} className="text-body">
                {paragraph}
              </p>
            ))}
            {section.bullets !== undefined && (
              <ul className="flex list-disc flex-col gap-1 pl-6 text-body">
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={`${section.heading}-bullet-${bulletIndex}`}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
