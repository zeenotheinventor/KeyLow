import { MONTH_NAMES_LONG } from "./diaryDay";

/**
 * The version of the Terms of Use and the Privacy Policy that people accept at sign-up. It is the date
 * the current wording took effect. A later version asks people to accept again.
 */
export const TERMS_VERSION = "2026-10-26";

/** The "Last updated" line under a document's title, from a version date such as `2026-10-15`. */
export function describeLastUpdated(versionDate: string): string {
  const [year, month, day] = versionDate.split("-").map(Number);
  return `Last updated ${day} ${MONTH_NAMES_LONG[(month ?? 1) - 1]} ${year}`;
}

const LAST_UPDATED = describeLastUpdated(TERMS_VERSION);

/** The route paths of the two pages on the web app. */
export const LEGAL_PATHS = {
  privacy: "/privacy",
  terms: "/terms",
} as const;

/** The public addresses of the two pages, which the mobile app links to. */
export const LEGAL_URLS = {
  privacy: "https://keylow-web.vercel.app/privacy",
  terms: "https://keylow-web.vercel.app/terms",
} as const;

/** Who runs Ki-Lo: the data controller named in the Privacy Policy. */
export const COMPANY_DETAILS = {
  name: "Sojisoft Limited",
  companyNumber: "15811949",
  registeredIn: "England and Wales",
  registeredOffice: "45 St Lukes Road, Maidstone, Kent, ME14 5AS",
  contactEmail: "hello@sojisoft.com",
  icoRegistrationNumber: "ZB798189",
} as const;

/** The footer: who runs Ki-Lo, and the links to the two documents. */
export const LEGAL_FOOTER = {
  companyLine: `Ki-Lo is run by ${COMPANY_DETAILS.name}, registered in ${COMPANY_DETAILS.registeredIn}, company number ${COMPANY_DETAILS.companyNumber}. Registered office: ${COMPANY_DETAILS.registeredOffice}.`,
  navigationLabel: "Legal",
  links: [
    { label: "Privacy Policy", path: LEGAL_PATHS.privacy },
    { label: "Terms of Use", path: LEGAL_PATHS.terms },
  ],
} as const;

/** One part of a legal document. The bullets, when there are any, follow the paragraphs. */
export type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
};

export const NOT_MEDICAL_ADVICE =
  "Ki-Lo's estimates and targets are not medical advice. Speak to a doctor before you make big changes to your diet or your weight.";

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: LAST_UPDATED,
  sections: [
    {
      heading: "Who runs Ki-Lo",
      paragraphs: [
        `Ki-Lo is run by ${COMPANY_DETAILS.name}. ${COMPANY_DETAILS.name} is the data controller for the information you give Ki-Lo. That means it decides how the information is used, and it is responsible for looking after it.`,
        `${COMPANY_DETAILS.name} is registered in ${COMPANY_DETAILS.registeredIn}, company number ${COMPANY_DETAILS.companyNumber}. Its registered office is ${COMPANY_DETAILS.registeredOffice}.`,
        `Its registration number with the Information Commissioner's Office (ICO) is ${COMPANY_DETAILS.icoRegistrationNumber}.`,
      ],
    },
    {
      heading: "What Ki-Lo stores",
      paragraphs: ["When you use Ki-Lo, it stores:"],
      bullets: [
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
        "If you turn the assistant on, your conversations with it, the list of changes it has made for you, and counts of how much you use it. The counts hold none of what you wrote.",
      ],
    },
    {
      heading: "Why Ki-Lo uses it",
      paragraphs: [
        "Ki-Lo uses your information to run your food diary, your workout log and the adaptive engine. The engine estimates your energy expenditure and sets your targets.",
        "If you turn the assistant on, Ki-Lo also uses your messages and your information to answer your questions and to log, copy and change entries for you.",
        "Your information is used for nothing else, apart from the error reports described under Who else handles your information.",
      ],
    },
    {
      heading: "Lawful basis",
      paragraphs: [
        "UK GDPR says a lawful basis is needed to use your information.",
        "For your account and the service you signed up for, the basis is providing that service to you.",
        "Your weight, body fat, lean mass, food diary, body stats, workouts, routines and training goals are health data. For health data, the basis is your explicit consent. You give it when you tick the box at sign-up.",
        "The assistant sends your messages and the health data it reads to Anthropic. For that, the basis is your explicit consent, which you give when you turn the assistant on. It is off until you do.",
        "You can withdraw your consent for the assistant at any time by turning it off in More, under Assistant. You can withdraw your consent for the rest of Ki-Lo at any time by deleting your account. See how to do that under How to use your rights.",
      ],
    },
    {
      heading: "Where your information is stored",
      paragraphs: [
        "Your information is stored with Supabase, in its London region (eu-west-2).",
        "Other people who use Ki-Lo cannot see your workouts, routines, training goals or the exercises you create.",
        "The mobile app also keeps a copy of what you have recently looked at on your phone, so that it opens without a connection. That includes your food diary and targets, and your workouts, routines and training goals. The copy is in storage private to the Ki-Lo app. Ki-Lo does not add encryption of its own to it. It is removed when you sign out.",
      ],
    },
    {
      heading: "Who else handles your information",
      paragraphs: [`These companies handle information on behalf of ${COMPANY_DETAILS.name}:`],
      bullets: [
        "Supabase: the database and sign-in.",
        "Vercel: hosts the web app.",
        "Expo: builds the mobile app and delivers app updates. When the app checks for updates, Expo sees the device's IP address and the app version. It never sees your diary or health data.",
        "Sentry: finds and fixes crashes and errors. When something goes wrong, it receives an error report: the app version, details of the device and app (such as the model, operating system, browser, language and time zone), the page or screen it happened on, the error's stack and your account ID. It never sees your diary, weigh-ins, body composition, body stats, workouts or training goals, and it does not keep your IP address. Sentry stores the reports in the EU, for 30 days.",
        "Anthropic: runs the AI model behind the assistant, and only if you turn the assistant on. It receives your messages and the Ki-Lo data the assistant reads to answer you or make a change. It deletes them within 30 days, unless it must keep them longer to enforce its usage policy or the law requires it, and it does not use them to train its models. Anthropic is based in the United States, so this data is processed outside the UK. Ki-Lo's agreement with Anthropic includes the UK's approved safeguard for that, the International Data Transfer Addendum.",
        "Google: only if you choose to sign in with Google. Google shares your account name, email address and a link to your profile picture with Ki-Lo.",
      ],
    },
    {
      heading: "Food and barcode lookups",
      paragraphs: [
        "Open Food Facts is an independent service. It receives only the barcode or the search text from Ki-Lo's servers, never anything about you. It sees Ki-Lo's servers, not your device.",
      ],
    },
    {
      heading: "What Ki-Lo never does",
      paragraphs: [
        "Your health data is never sold. It is never used for advertising. It is never shared with anyone beyond the companies listed above. Anthropic receives your health data only while the assistant is on, and only what you tell it and what it reads to answer you or make a change.",
      ],
    },
    {
      heading: "How long it is kept",
      paragraphs: [
        "Your information is kept until you delete your account. After that, it is deleted.",
        "Your assistant conversations are kept until you delete them or delete your account. You can delete them in More, under Assistant. The list of changes the assistant has made for you is kept until you delete your account.",
        "The exceptions are error reports, which Sentry keeps for 30 days, and what the assistant sent to Anthropic, which Anthropic keeps for up to 30 days. Both can outlast a deleted account, and Anthropic's copy can outlast a deleted conversation, by up to 30 days. Anthropic can keep its copy longer only to enforce its usage policy or where the law requires it.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: ["You have the right to:"],
      bullets: [
        "Ask for a copy of the information held about you (access).",
        "Have anything wrong in it corrected.",
        "Take your information with you (export).",
        "Have your information deleted.",
        "Withdraw your consent.",
        "Complain to the Information Commissioner's Office (ICO) at ico.org.uk.",
      ],
    },
    {
      heading: "How to use your rights",
      paragraphs: [
        `Email ${COMPANY_DETAILS.contactEmail} and say what you need.`,
        `Today, you export or delete your information by emailing ${COMPANY_DETAILS.contactEmail}. In-app export and delete are on the way.`,
      ],
    },
    {
      heading: "Not medical advice",
      paragraphs: [NOT_MEDICAL_ADVICE],
    },
    {
      heading: "Cookies",
      paragraphs: [
        "The web app sets only the cookies it needs. They keep you signed in and remember your choice of light or dark appearance.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "If this policy changes, the new version is dated. You will be asked to accept it again.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Questions about this policy or your information? Email ${COMPANY_DETAILS.contactEmail}.`,
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: "Terms of Use",
  lastUpdated: LAST_UPDATED,
  sections: [
    {
      heading: "About these terms",
      paragraphs: [
        "These terms cover your use of Ki-Lo, an app for tracking your food, your weight and your training. By using Ki-Lo, you agree to them.",
      ],
    },
    {
      heading: "Personal use",
      paragraphs: [
        "Ki-Lo is for your personal use. It is provided as it is, with no warranty.",
        `${COMPANY_DETAILS.name} works to keep Ki-Lo running and accurate. It cannot promise that Ki-Lo will always be available or free of mistakes.`,
        "Nothing in these terms takes away any right you have under the law.",
      ],
    },
    {
      heading: "Not medical advice",
      paragraphs: [NOT_MEDICAL_ADVICE],
    },
    {
      heading: "Your account",
      paragraphs: [
        `You are responsible for your account and for keeping your sign-in safe. Email ${COMPANY_DETAILS.contactEmail} if you think someone else has used your account.`,
      ],
    },
    {
      heading: "Ending your account",
      paragraphs: [
        "You can delete your account at any time.",
        `Today, you delete your account by emailing ${COMPANY_DETAILS.contactEmail}. In-app delete is on the way. What happens to your information is in the Privacy Policy.`,
      ],
    },
    {
      heading: "Changes to Ki-Lo and these terms",
      paragraphs: [
        `${COMPANY_DETAILS.name} may change or stop Ki-Lo. It may also change these terms. If it does, the new version is dated and you will be asked to accept it again.`,
      ],
    },
    {
      heading: "Governing law",
      paragraphs: ["These terms are governed by the law of England and Wales."],
    },
    {
      heading: "Who runs Ki-Lo",
      paragraphs: [
        `Ki-Lo is run by ${COMPANY_DETAILS.name}, registered in ${COMPANY_DETAILS.registeredIn}, company number ${COMPANY_DETAILS.companyNumber}. Its registered office is ${COMPANY_DETAILS.registeredOffice}.`,
        `Email ${COMPANY_DETAILS.contactEmail} to reach it.`,
      ],
    },
  ],
};
