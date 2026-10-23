import { describe, expect, it } from "vitest";

import {
  COMPANY_DETAILS,
  LEGAL_FOOTER,
  LEGAL_PATHS,
  LEGAL_URLS,
  PRIVACY_POLICY,
  TERMS,
  TERMS_VERSION,
} from "../../src/copy";
import { describeLastUpdated } from "../../src/copy/legal";
import { needsTermsAcceptance } from "../../src/terms";

import type { LegalDocument } from "../../src/copy";

const documents: ReadonlyArray<readonly [string, LegalDocument]> = [
  ["Privacy Policy", PRIVACY_POLICY],
  ["Terms", TERMS],
];

function textOf(document: LegalDocument): string[] {
  return [
    document.title,
    document.lastUpdated,
    ...document.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
    ]),
  ];
}

function headingsOf(document: LegalDocument): string[] {
  return document.sections.map((section) => section.heading);
}

function allTextOf(document: LegalDocument): string {
  return textOf(document).join("\n");
}

describe("the legal copy", () => {
  describe("the terms version", () => {
    it("should be the date the current terms took effect", () => {
      expect(TERMS_VERSION).toBe("2026-10-23");
    });

    it("should ask someone who accepted the terms of 18 October 2026 to accept again", () => {
      expect(
        needsTermsAcceptance(
          { terms_accepted_at: "2026-10-19T09:30:00+00:00", terms_version: "2026-10-18" },
          TERMS_VERSION,
        ),
      ).toBe(true);
    });

    it("should not ask someone who accepted the current terms again", () => {
      expect(
        needsTermsAcceptance(
          { terms_accepted_at: "2026-10-23T09:30:00+00:00", terms_version: TERMS_VERSION },
          TERMS_VERSION,
        ),
      ).toBe(false);
    });
  });

  describe("the last updated line", () => {
    it("should write the version date out in words", () => {
      expect(describeLastUpdated("2026-10-15")).toBe("Last updated 15 October 2026");
    });

    it("should drop the leading zero of the day", () => {
      expect(describeLastUpdated("2027-01-03")).toBe("Last updated 3 January 2027");
    });

    it("should be what both documents show for the current terms version", () => {
      expect(PRIVACY_POLICY.lastUpdated).toBe(describeLastUpdated(TERMS_VERSION));
      expect(TERMS.lastUpdated).toBe(describeLastUpdated(TERMS_VERSION));
    });
  });

  describe("where the documents live", () => {
    it("should give the route paths of the two pages", () => {
      expect(LEGAL_PATHS).toEqual({ privacy: "/privacy", terms: "/terms" });
    });

    it("should give the public addresses the mobile app will link to", () => {
      expect(LEGAL_URLS).toEqual({
        privacy: "https://keylow-web.vercel.app/privacy",
        terms: "https://keylow-web.vercel.app/terms",
      });
    });

    it("should end each public address with its route path", () => {
      expect(LEGAL_URLS.privacy.endsWith(LEGAL_PATHS.privacy)).toBe(true);
      expect(LEGAL_URLS.terms.endsWith(LEGAL_PATHS.terms)).toBe(true);
    });
  });

  describe("the company details", () => {
    it("should name the company that runs Ki-Lo", () => {
      expect(COMPANY_DETAILS).toEqual({
        name: "Sojisoft Limited",
        companyNumber: "15811949",
        registeredIn: "England and Wales",
        registeredOffice: "45 St Lukes Road, Maidstone, Kent, ME14 5AS",
        contactEmail: "hello@sojisoft.com",
        icoRegistrationNumber: "ZB798189",
      });
    });
  });

  describe("the footer", () => {
    it("should state who runs Ki-Lo, where it is registered and its number and office", () => {
      expect(LEGAL_FOOTER.companyLine).toBe(
        "Ki-Lo is run by Sojisoft Limited, registered in England and Wales, company number 15811949. Registered office: 45 St Lukes Road, Maidstone, Kent, ME14 5AS.",
      );
    });

    it("should not show the ICO registration number", () => {
      expect(LEGAL_FOOTER.companyLine).not.toContain(COMPANY_DETAILS.icoRegistrationNumber);
    });

    it("should link to the Privacy Policy and the Terms of Use", () => {
      expect(LEGAL_FOOTER.links).toEqual([
        { label: "Privacy Policy", path: "/privacy" },
        { label: "Terms of Use", path: "/terms" },
      ]);
    });

    it("should name the navigation landmark", () => {
      expect(LEGAL_FOOTER.navigationLabel).toBe("Legal");
    });
  });

  describe.each(documents)("the %s", (_name, document) => {
    it("should carry the date it was last updated", () => {
      expect(document.lastUpdated).toBe("Last updated 23 October 2026");
    });

    it("should have sections that each have a heading and at least one paragraph", () => {
      expect(document.sections.length).toBeGreaterThan(0);
      for (const section of document.sections) {
        expect(section.heading).not.toBe("");
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    });

    it("should not repeat a heading", () => {
      const headings = headingsOf(document);
      expect(new Set(headings).size).toBe(headings.length);
    });

    it("should name the product Ki-Lo", () => {
      expect(allTextOf(document)).toContain("Ki-Lo");
    });

    it("should say who runs Ki-Lo and how to reach them", () => {
      const text = allTextOf(document);
      expect(text).toContain("Sojisoft Limited");
      expect(text).toContain("hello@sojisoft.com");
    });

    it("should never speak as we, us or our", () => {
      for (const line of textOf(document)) {
        expect(line).not.toMatch(/\b(we|us|our)\b/i);
      }
    });

    it("should use no em dash, double hyphen or semicolon", () => {
      for (const line of textOf(document)) {
        expect(line).not.toMatch(/—|--|;/);
      }
    });

    it("should use British spelling", () => {
      expect(allTextOf(document)).not.toMatch(
        /\b(color|favorite|organization|license|center|analyze|authorize)/i,
      );
    });

    it("should say in-app export and delete are on the way, not that they exist", () => {
      expect(allTextOf(document)).toContain("on the way");
      expect(allTextOf(document)).not.toMatch(/Settings/);
    });
  });

  describe("the Privacy Policy", () => {
    const text = allTextOf(PRIVACY_POLICY);

    it("should be titled Privacy Policy", () => {
      expect(PRIVACY_POLICY.title).toBe("Privacy Policy");
    });

    it("should name the data controller, its registered office and number", () => {
      expect(text).toContain("data controller");
      expect(text).toContain("45 St Lukes Road, Maidstone, Kent, ME14 5AS");
      expect(text).toContain("15811949");
    });

    it("should give the ICO registration number", () => {
      expect(text).toContain("ZB798189");
    });

    it("should list what Ki-Lo stores", () => {
      const stored = PRIVACY_POLICY.sections.find(
        (section) => section.heading === "What Ki-Lo stores",
      );
      expect(stored?.bullets).toEqual([
        "Your email address and, if you sign in with email, a password. The password is kept only in a form that cannot be read back.",
        "If you sign in with Google, your Google account name, email address and a link to your profile picture.",
        "Your profile stats.",
        "Your weigh-ins, including any imported from Health Connect.",
        "Your body fat and lean mass readings, imported from Health Connect. Ki-Lo keeps only the value and the time of each reading.",
        "Your food diary.",
        "Your custom foods and recipes.",
        "Your workouts: sessions, sets, loads and the exercises you create.",
        "Your routines and training goals.",
        "Your goals, your targets and your expenditure estimates.",
      ]);
    });

    it("should name neither Apple nor HealthKit", () => {
      expect(text).not.toMatch(/Apple|HealthKit/);
    });

    it("should say the information runs the food diary, the workout log and the adaptive engine", () => {
      const why = PRIVACY_POLICY.sections.find(
        (section) => section.heading === "Why Ki-Lo uses it",
      );
      expect(why?.paragraphs[0]).toBe(
        "Ki-Lo uses your information to run your food diary, your workout log and the adaptive engine. The engine estimates your energy expenditure and sets your targets.",
      );
    });

    it("should name workouts, routines and training goals as health data", () => {
      const basis = PRIVACY_POLICY.sections.find((section) => section.heading === "Lawful basis");
      expect(basis?.paragraphs).toContain(
        "Your weight, body fat, lean mass, food diary, body stats, workouts, routines and training goals are health data. For health data, the basis is your explicit consent. You give it when you tick the box at sign-up.",
      );
    });

    it("should say who cannot see the workouts, and that the mobile app keeps a copy on the phone with no encryption of its own, removed at sign out", () => {
      const stored = PRIVACY_POLICY.sections.find(
        (section) => section.heading === "Where your information is stored",
      );
      expect(stored?.paragraphs).toEqual([
        "Your information is stored with Supabase, in its London region (eu-west-2).",
        "Other people who use Ki-Lo cannot see your workouts, routines, training goals or the exercises you create.",
        "The mobile app also keeps a copy of what you have recently looked at on your phone, so that it opens without a connection. That includes your food diary and targets, and your workouts, routines and training goals. The copy is in storage private to the Ki-Lo app. Ki-Lo does not add encryption of its own to it. It is removed when you sign out.",
      ]);
    });

    it("should say the information is used only to run the diary and the adaptive engine", () => {
      expect(text).toContain(
        "Your information is used for nothing else, apart from the error reports described under Who else handles your information.",
      );
    });

    it("should rest health data on explicit consent given by ticking the box at sign-up", () => {
      expect(text).toContain("explicit consent");
      expect(text).toContain("tick the box at sign-up");
    });

    it("should say consent can be withdrawn by deleting the account", () => {
      expect(text).toContain("withdraw your consent");
      expect(text).toContain("deleting your account");
    });

    it("should say where the information is stored", () => {
      expect(text).toContain("Supabase, in its London region (eu-west-2)");
    });

    it("should list every other company that handles information, and what it does", () => {
      const processors = PRIVACY_POLICY.sections.find(
        (section) => section.heading === "Who else handles your information",
      );
      expect(processors?.bullets).toEqual([
        "Supabase: the database and sign-in.",
        "Vercel: hosts the web app.",
        "Expo: builds the mobile app and delivers app updates. When the app checks for updates, Expo sees the device's IP address and the app version. It never sees your diary or health data.",
        "Sentry: finds and fixes crashes and errors. When something goes wrong, it receives an error report: the app version, details of the device and app (such as the model, operating system, browser, language and time zone), the page or screen it happened on, the error's stack and your account ID. It never sees your diary, weigh-ins, body composition, body stats, workouts or training goals, and it does not keep your IP address. Sentry stores the reports in the EU, for 30 days.",
        "Google: only if you choose to sign in with Google. Google shares your account name, email address and a link to your profile picture with Ki-Lo.",
      ]);
    });

    it("should say Open Food Facts is an independent service that sees only the barcode or search text", () => {
      const lookups = PRIVACY_POLICY.sections.find(
        (section) => section.heading === "Food and barcode lookups",
      );
      expect(lookups?.paragraphs).toEqual([
        "Open Food Facts is an independent service. It receives only the barcode or the search text from Ki-Lo's servers, never anything about you. It sees Ki-Lo's servers, not your device.",
      ]);
      expect(lookups?.bullets).toBeUndefined();
    });

    it("should promise health data is never sold, used for advertising or shared beyond those companies", () => {
      expect(text).toContain("Your health data is never sold.");
      expect(text).toContain("It is never used for advertising.");
      expect(text).toContain("It is never shared with anyone beyond the companies listed above.");
    });

    it("should keep information until the account is deleted, then delete it", () => {
      expect(text).toContain("Your information is kept until you delete your account.");
    });

    it("should say error reports are kept for 30 days and can outlast a deleted account", () => {
      expect(text).toContain(
        "Error reports are the one exception: they are kept for 30 days, so they can outlast a deleted account by up to 30 days.",
      );
    });

    it("should list the rights, including a complaint to the ICO at ico.org.uk", () => {
      const rights = PRIVACY_POLICY.sections.find((section) => section.heading === "Your rights");
      expect(rights?.bullets).toHaveLength(6);
      expect(rights?.bullets?.join("\n")).toContain("ico.org.uk");
    });

    it("should tell people to email to use their rights, and say in-app export and delete are on the way", () => {
      const how = PRIVACY_POLICY.sections.find(
        (section) => section.heading === "How to use your rights",
      );
      expect(how?.paragraphs).toEqual([
        "Email hello@sojisoft.com and say what you need.",
        "Today, you export or delete your information by emailing hello@sojisoft.com. In-app export and delete are on the way.",
      ]);
    });

    it("should say the estimates are not medical advice", () => {
      expect(text).toContain("not medical advice");
      expect(text).toContain("Speak to a doctor");
    });

    it("should say which cookies the web app sets", () => {
      const cookies = PRIVACY_POLICY.sections.find((section) => section.heading === "Cookies");
      expect(cookies?.paragraphs.join(" ")).toContain("keep you signed in");
      expect(cookies?.paragraphs.join(" ")).toContain("light or dark");
    });

    it("should say a changed policy is dated and has to be accepted again", () => {
      expect(text).toContain("You will be asked to accept it again.");
    });
  });

  describe("the Terms", () => {
    const text = allTextOf(TERMS);

    it("should be titled Terms of Use", () => {
      expect(TERMS.title).toBe("Terms of Use");
    });

    it("should say Ki-Lo is an app for tracking food, weight and training", () => {
      const about = TERMS.sections.find((section) => section.heading === "About these terms");
      expect(about?.paragraphs).toEqual([
        "These terms cover your use of Ki-Lo, an app for tracking your food, your weight and your training. By using Ki-Lo, you agree to them.",
      ]);
    });

    it("should say Ki-Lo is for personal use, provided as it is with no warranty", () => {
      expect(text).toContain("personal use");
      expect(text).toContain("as it is, with no warranty");
    });

    it("should say the estimates are not medical advice", () => {
      expect(text).toContain("not medical advice");
    });

    it("should make the person responsible for their account", () => {
      expect(text).toContain("You are responsible for your account");
    });

    it("should say the account can be deleted at any time, by email until in-app delete exists", () => {
      expect(text).toContain("You can delete your account at any time.");
      expect(text).toContain("Today, you delete your account by emailing hello@sojisoft.com.");
      expect(text).toContain("In-app delete is on the way.");
    });

    it("should say the service may change or stop", () => {
      expect(text).toContain("Sojisoft Limited may change or stop Ki-Lo.");
    });

    it("should be governed by the law of England and Wales", () => {
      expect(text).toContain("governed by the law of England and Wales");
    });
  });
});
