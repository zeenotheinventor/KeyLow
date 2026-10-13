import { Geist } from "next/font/google";

import { applyTheme } from "./applyTheme";

import type { Decorator, Preview } from "@storybook/nextjs";

import "../app/globals.css";

// The same call as app/layout.tsx, so Storybook's next/font mock defines the same --font-geist
// variable that the Tailwind font stack reads.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

const withTheme: Decorator = (Story, context) => {
  const root = document.documentElement;
  root.classList.add(geist.variable);
  applyTheme(root, context.globals.theme);
  return Story();
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: { theme: "dark" },
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        desktop: { name: "Desktop 1280", styles: { width: "1280px", height: "800px" } },
        mobile: { name: "Mobile 375", styles: { width: "375px", height: "812px" } },
      },
    },
  },
};

export default preview;
