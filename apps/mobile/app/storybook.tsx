import { Redirect } from "expo-router";

import StorybookUI from "../.rnstorybook";

// A build made without EXPO_PUBLIC_STORYBOOK=true has the import above replaced by a stub in metro.config.js, so
// it carries no Storybook, and the redirect below sends anyone who opens the link to the home route.
export default function StorybookRoute() {
  return process.env.EXPO_PUBLIC_STORYBOOK === "true" ? <StorybookUI /> : <Redirect href="/" />;
}
